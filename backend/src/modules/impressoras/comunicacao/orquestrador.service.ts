import { access, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { ArquivoRepository } from "../../arquivos/arquivos.repository";
import { PedidoRepository } from "../../pedidos/pedidos.repository";
import { Impressora, ImpressoraRepository, PrinterStatus } from "../impressoras.repository";
import { PrinterAdapterFactory } from "./printer-adapter.factory";
import { PrinterHealthCheckResult, PrinterRuntimeStatus, PrinterStartJobResult } from "./tipos";

export interface AssignPrintJobResult {
  impressora: Impressora;
  pedidoId: number;
  comunicacao: PrinterStartJobResult;
}

export class ImpressoraOrquestradorService {
  constructor(
    private readonly impressoraRepository: ImpressoraRepository,
    private readonly pedidoRepository: PedidoRepository,
    private readonly arquivoRepository: ArquivoRepository,
    private readonly adapterFactory: PrinterAdapterFactory,
  ) {}

  async testarConexao(impressoraId: number): Promise<PrinterHealthCheckResult> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      const resultado = await adapter.healthCheck(impressora);
      await this.impressoraRepository.update(impressoraId, {
        ultimoErro: null,
        statusFisico: resultado.mensagem,
        ultimaSincronizacao: new Date().toISOString().slice(0, 19).replace("T", " "),
      });
      await this.impressoraRepository.addEvent(impressoraId, "health_check", resultado.mensagem, resultado.detalhes);
      return resultado;
    } catch (error: any) {
      const mensagem = error?.message ?? "Falha desconhecida no teste de conexão.";
      await this.impressoraRepository.markError(impressoraId, mensagem);
      await this.impressoraRepository.addEvent(impressoraId, "health_check_error", mensagem);
      throw new Error(mensagem);
    }
  }

  async sincronizarStatus(impressoraId: number): Promise<Impressora> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      const status = await adapter.getStatus(impressora);
      await this.persistirStatusSincronizado(impressoraId, status);
      await this.sincronizarPedidoComStatus(impressora, status);
      await this.impressoraRepository.addEvent(impressoraId, "status_sync", `Status físico: ${status.statusFisico}`, status.detalhes);
      return await this.obterImpressoraOuFalhar(impressoraId);
    } catch (error: any) {
      const mensagem = error?.message ?? "Falha ao sincronizar status da impressora.";
      await this.impressoraRepository.markError(impressoraId, mensagem);
      await this.impressoraRepository.addEvent(impressoraId, "status_sync_error", mensagem);
      throw new Error(mensagem);
    }
  }

  async atribuirPedido(impressoraId: number, pedidoId: number): Promise<AssignPrintJobResult> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);

    const reservada = await this.impressoraRepository.reserveIfIdle(impressoraId);
    if (!reservada) {
      throw new Error("Impressora não está ociosa para receber um novo pedido.");
    }

    await this.impressoraRepository.addEvent(impressoraId, "reservation", `Impressora reservada para o pedido ${pedidoId}.`);

    try {
      const pedido = await this.pedidoRepository.findById(pedidoId);
      if (!pedido) {
        throw new Error("Pedido não encontrado.");
      }

      if (pedido.status === "concluido" || pedido.status === "cancelado") {
        throw new Error("Pedido não pode ser enviado porque já foi finalizado ou cancelado.");
      }

      const arquivo = await this.arquivoRepository.findById(pedido.idArquivo);
      if (!arquivo) {
        throw new Error("Arquivo vinculado ao pedido não foi encontrado.");
      }

      if (arquivo.tipo !== "gcode") {
        throw new Error("O arquivo do pedido precisa ser um G-code para envio à impressora.");
      }

      await access(arquivo.caminho, constants.R_OK);
      const conteudo = await readFile(arquivo.caminho);
      const nomeArquivo = path.basename(arquivo.caminho);

      const adapter = this.adapterFactory.getAdapter(impressora.api);
      const resultado = await adapter.uploadAndStart(impressora, {
        nomeArquivo,
        conteudo,
      });

      if (!resultado.ok) {
        throw new Error(resultado.mensagem);
      }

      await this.impressoraRepository.markPrinting(impressoraId, resultado.jobRemotoId, resultado.nomeArquivoRemoto ?? resultado.mensagem);
      await this.pedidoRepository.update(pedidoId, { status: "em_impressao" });
      await this.impressoraRepository.addEvent(
        impressoraId,
        "job_started",
        `Pedido ${pedidoId} enviado para a impressora.`,
        resultado.rawStatus,
      );

      return {
        impressora: await this.obterImpressoraOuFalhar(impressoraId),
        pedidoId,
        comunicacao: resultado,
      };
    } catch (error: any) {
      const mensagem = error?.message ?? "Falha desconhecida ao atribuir pedido à impressora.";
      await this.impressoraRepository.markError(impressoraId, mensagem);
      await this.impressoraRepository.addEvent(impressoraId, "job_start_error", mensagem);
      throw new Error(mensagem);
    }
  }

  async liberarImpressora(impressoraId: number): Promise<Impressora> {
    await this.obterImpressoraOuFalhar(impressoraId);
    await this.impressoraRepository.release(impressoraId, "Ociosa");
    await this.impressoraRepository.addEvent(impressoraId, "release", "Impressora liberada manualmente.");
    return this.obterImpressoraOuFalhar(impressoraId);
  }

  async listarEventos(impressoraId: number, limit = 20) {
    await this.obterImpressoraOuFalhar(impressoraId);
    return this.impressoraRepository.listEvents(impressoraId, limit);
  }

  private async obterImpressoraOuFalhar(impressoraId: number): Promise<Impressora> {
    const impressora = await this.impressoraRepository.findById(impressoraId);
    if (!impressora) {
      throw new Error("Impressora não encontrada.");
    }

    return impressora;
  }

  private async persistirStatusSincronizado(impressoraId: number, status: PrinterRuntimeStatus): Promise<void> {
    const updateStatus: PrinterStatus = status.statusDominio;
    await this.impressoraRepository.update(impressoraId, {
      status: updateStatus,
      statusFisico: status.statusFisico,
      jobRemotoId: status.jobRemotoId ?? null,
      ultimoErro: status.statusDominio === "Erro" ? status.mensagem ?? "Erro informado pela impressora." : null,
      ultimaSincronizacao: new Date().toISOString().slice(0, 19).replace("T", " "),
    });
  }

  private async sincronizarPedidoComStatus(impressora: Impressora, status: PrinterRuntimeStatus): Promise<void> {
    if (!impressora.jobRemotoId) {
      return;
    }

    const eventos = await this.impressoraRepository.listEvents(impressora.id, 1);
    const ultimoEvento = eventos[0];

    if (status.statusDominio === "Ociosa" && impressora.status === "Imprimindo") {
      if (ultimoEvento?.tipo !== "job_finished") {
        await this.impressoraRepository.addEvent(
          impressora.id,
          "job_finished",
          "A impressora voltou para ociosa após concluir ou encerrar o trabalho.",
          status.detalhes,
        );
      }
    }
  }
}
