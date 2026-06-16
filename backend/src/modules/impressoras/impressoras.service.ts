import {
  ApiProtocol,
  Impressora,
  ImpressoraRepository,
  PrinterStatus,
} from "./impressoras.repository";
import { ArquivoRepository } from "../arquivos/arquivos.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import { PrinterAdapterFactory } from "./comunicacao/printer-adapter.factory";
import { ImpressoraOrquestradorService } from "./comunicacao/orquestrador.service";
import { PrinterHealthCheckResult } from "./comunicacao/tipos";

export interface ProgressoImpressora {
  progressoPct: number | null;
  tempoRestanteS: number | null;
  statusFisico: string;
}

export interface CreateImpressoraServiceDTO {
  nome: string;
  modelo: string;
  status?: PrinterStatus;
  ip?: string | null;
  baseUrl?: string | null;
  api: ApiProtocol;
  api_key?: string | null;
  timeoutMs?: number;
  idMaterial?: number | null;
}

export interface UpdateImpressoraServiceDTO {
  nome?: string;
  modelo?: string;
  status?: PrinterStatus;
  ip?: string | null;
  baseUrl?: string | null;
  api?: ApiProtocol;
  api_key?: string | null;
  timeoutMs?: number;
  idMaterial?: number | null;
}

export class ImpressoraService {
  private readonly adapterFactory = new PrinterAdapterFactory();
  private readonly pedidoRepository = new PedidoRepository();
  private readonly arquivoRepository = new ArquivoRepository();
  private readonly orquestrador = new ImpressoraOrquestradorService(
    this.impressoraRepository,
    this.pedidoRepository,
    this.arquivoRepository,
    this.adapterFactory,
  );

  constructor(private readonly impressoraRepository: ImpressoraRepository) {}

  async listar(): Promise<Impressora[]> {
    return this.impressoraRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Impressora | null> {
    return this.impressoraRepository.findById(id);
  }

  async criar(data: CreateImpressoraServiceDTO): Promise<Impressora | null> {
    const id = await this.impressoraRepository.create({
      ...data,
      status: data.status ?? "Ociosa",
      timeoutMs: data.timeoutMs ?? 15000,
    });

    return this.impressoraRepository.findById(id);
  }

  async atualizar(
    id: number,
    data: UpdateImpressoraServiceDTO,
  ): Promise<Impressora | null> {
    const impressora = await this.impressoraRepository.findById(id);

    if (!impressora) {
      throw new Error("Impressora não encontrada.");
    }

    await this.impressoraRepository.update(id, data);
    return this.impressoraRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const impressora = await this.impressoraRepository.findById(id);

    if (!impressora) {
      throw new Error("Impressora não encontrada.");
    }

    if (impressora.status === "Imprimindo" || impressora.status === "Reservada") {
      throw new Error("Não é possível remover uma impressora em uso.");
    }

    await this.impressoraRepository.delete(id);
    return { message: "Impressora removida com sucesso." };
  }

  async testarConexao(id: number): Promise<PrinterHealthCheckResult> {
    return this.orquestrador.testarConexao(id);
  }

  async sincronizarStatus(id: number): Promise<Impressora> {
    return this.orquestrador.sincronizarStatus(id);
  }

  async atribuirPedido(idImpressora: number, idPedido: number) {
    return this.orquestrador.atribuirPedido(idImpressora, idPedido);
  }

  async liberar(idImpressora: number): Promise<Impressora> {
    return this.orquestrador.liberarImpressora(idImpressora);
  }

  async confirmarRemocao(idImpressora: number): Promise<Impressora> {
    return this.orquestrador.confirmarRemocao(idImpressora);
  }

  async listarEventos(idImpressora: number, limit = 20) {
    return this.orquestrador.listarEventos(idImpressora, limit);
  }

  async obterProgresso(id: number): Promise<ProgressoImpressora> {
    const impressora = await this.impressoraRepository.findById(id);
    if (!impressora) throw new Error("Impressora não encontrada.");
    const adapter = this.adapterFactory.getAdapter(impressora.api);
    try {
      const status = await adapter.getStatus(impressora);
      return {
        progressoPct: status.progressoPct ?? null,
        tempoRestanteS: status.tempoRestanteS ?? null,
        statusFisico: status.statusFisico,
      };
    } catch {
      return { progressoPct: null, tempoRestanteS: null, statusFisico: "desconhecido" };
    }
  }
}
