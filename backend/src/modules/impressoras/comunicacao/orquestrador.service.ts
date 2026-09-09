import { constants } from "node:fs";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { ArquivoRepository } from "../../arquivos/arquivos.repository";
import { FilaService } from "../../fila/fila.service";
import {
  PedidoImpressoraRepository,
  PedidoImpressoraStateError,
  ReservaAlocacao,
} from "../../fila/pedidoImpressora.repository";
import { JobImpressaoRepository } from "../../fila/jobsImpressao.repository";
import { Pedido, PedidoRepository } from "../../pedidos/pedidos.repository";
import {
  emailImpressoraErro,
  emailPedidoConcluido,
  emailClientePecaPronta,
  emailClientePedidoFalhou,
  emailAguardandoFilamento,
  emailClienteImpressaoIniciada,
  emailClienteCopiaConcluida,
} from "../../../services/email.service";
import { Impressora, ImpressoraRepository, SlotFilamento } from "../impressoras.repository";
import { validarExtrusorLogicoMonomaterial } from "./gcode-logical-filament.parser";
import { PrinterAdapterFactory } from "./printer-adapter.factory";
import {
  CfsFilamentMapping,
  CfsInventory,
  CfsInventoryItem,
  CfsPrintAdapterError,
  CfsPrintStartResult,
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

export interface AssignPrintJobResult {
  impressora: Impressora;
  pedidoId: number;
  comunicacao: PrinterStartJobResult;
}

interface PlanejadorFila {
  reescalonarFilaVirtual(): Promise<unknown>;
}

interface IdentificadoresInicioEsperados {
  jobRemotoId?: string | null;
  nomeArquivoRemoto?: string | null;
}

class AguardandoFilamentoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AguardandoFilamentoError";
  }
}

class InicioFisicoIncertoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InicioFisicoIncertoError";
  }
}

const MAX_ALOCACOES_POR_VARREDURA = 100;
const CONFIRMACAO_INICIO_TIMEOUT_MS = 15_000;
const CONFIRMACAO_INICIO_INTERVALO_MS = 1_000;
// Teto do timeout HTTP de cada chamada de status durante a confirmação de
// início, independente do timeoutMs configurado da impressora — ver
// confirmarInicioFisico.
const CONFIRMACAO_INICIO_POLL_HTTP_TIMEOUT_MS = 5_000;

function agoraSql(): string {
  return new Date().toISOString().slice(0, 19).replace("T", " ");
}

function textoComparavel(value: string): string {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function identificadorRemotoComparavel(value: string): string {
  return value.trim().replace(/\\/g, "/");
}

function identificadoresRemotosCorrespondem(observado: string, esperado: string): boolean {
  const observadoNormalizado = identificadorRemotoComparavel(observado);
  const esperadoNormalizado = identificadorRemotoComparavel(esperado);
  if (observadoNormalizado === esperadoNormalizado) return true;

  const nomeObservado = observadoNormalizado.split("/").pop();
  const nomeEsperado = esperadoNormalizado.split("/").pop();
  return Boolean(nomeObservado && nomeEsperado && nomeObservado === nomeEsperado);
}

function textosOpcionaisCorrespondem(observado: unknown, esperado: unknown): boolean {
  if (observado === undefined && esperado === undefined) return true;
  if (typeof observado !== "string" || typeof esperado !== "string") return false;
  return textoComparavel(observado) === textoComparavel(esperado);
}

function mensagemErro(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function falhaNaoRecuperavel(error: unknown): boolean {
  if (error instanceof CfsPrintAdapterError) {
    return [
      "CFS_MAPPING_UNSUPPORTED",
      "CFS_NOT_CONFIGURED",
      "CFS_SLOT_NOT_FOUND",
      "CFS_MAPPING_INVALID",
    ].includes(error.code);
  }

  if (!(error instanceof Error)) return false;
  return (
    error.name === "GcodeLogicalFilamentError" ||
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

export class ImpressoraOrquestradorService {
  constructor(
    private readonly impressoraRepository: ImpressoraRepository,
    private readonly pedidoRepository: PedidoRepository,
    private readonly arquivoRepository: ArquivoRepository, // preservado no contrato público
    private readonly adapterFactory: PrinterAdapterFactory,
    private readonly pedidoImpressoraRepository = new PedidoImpressoraRepository(),
    private readonly filaService: PlanejadorFila = new FilaService(
      pedidoRepository,
      impressoraRepository,
      undefined,
      pedidoImpressoraRepository,
    ),
    private readonly aguardar: (milissegundos: number) => Promise<void> =
      (milissegundos) => new Promise((resolve) => setTimeout(resolve, milissegundos)),
    private readonly jobImpressaoRepository = new JobImpressaoRepository(),
  ) {
    // A referência continua injetável e pronta para o fluxo de arquivos, sem I/O no construtor.
    void this.arquivoRepository;
  }

  async testarConexao(impressoraId: number): Promise<PrinterHealthCheckResult> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      const resultado = await adapter.healthCheck(impressora);
      await this.impressoraRepository.update(impressoraId, {
        ...(this.possuiReservaComInicioIncerto(impressora) ? {} : { ultimoErro: null }),
        statusFisico: resultado.mensagem,
        ultimaSincronizacao: agoraSql(),
      });
      await this.impressoraRepository.addEvent(
        impressoraId,
        "health_check",
        resultado.mensagem,
        resultado.detalhes,
      );
      return resultado;
    } catch (error) {
      const mensagem = mensagemErro(error, "Falha desconhecida no teste de conexão.");
      // Um health check não pode sobrescrever Reserva/Impressão/Aguardando Remoção.
      await this.impressoraRepository.update(impressoraId, {
        ultimoErro: mensagem,
        ultimaSincronizacao: agoraSql(),
      });
      await this.impressoraRepository.addEvent(impressoraId, "health_check_error", mensagem);
      await emailImpressoraErro({
        id: impressora.id,
        nome: impressora.nome,
        modelo: impressora.modelo,
        ultimoErro: mensagem,
      });
      throw new Error(mensagem);
    }
  }

  async sincronizarStatus(impressoraId: number): Promise<Impressora> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      const status = await adapter.getStatus(impressora);
      await this.persistirStatusFisico(impressora, status);
      const inicioReconciliado = await this.reconciliarReservaComInicioIncerto(impressora, status);
      if (inicioReconciliado) {
        await this.impressoraRepository.addEvent(
          impressoraId,
          "status_sync",
          `Status físico: ${status.statusFisico}`,
          status.detalhes,
        );
        return await this.obterImpressoraOuFalhar(impressoraId);
      }
      await this.sincronizarPedidoComStatus(impressora, status);
      await this.impressoraRepository.addEvent(
        impressoraId,
        "status_sync",
        `Status físico: ${status.statusFisico}`,
        status.detalhes,
      );
      return await this.obterImpressoraOuFalhar(impressoraId);
    } catch (error) {
      const mensagem = mensagemErro(error, "Falha ao sincronizar status da impressora.");
      await this.impressoraRepository.update(impressoraId, {
        ultimoErro: mensagem,
        ultimaSincronizacao: agoraSql(),
      });
      await this.impressoraRepository.addEvent(impressoraId, "status_sync_error", mensagem);
      await emailImpressoraErro({
        id: impressora.id,
        nome: impressora.nome,
        modelo: impressora.modelo,
        ultimoErro: mensagem,
      });
      throw new Error(mensagem);
    }
  }

  async sincronizarStatusSilencioso(
    impressoraId: number,
  ): Promise<PrinterRuntimeStatus | null> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      const status = await adapter.getStatus(impressora);
      await this.persistirStatusFisico(impressora, status);
      const inicioReconciliado = await this.reconciliarReservaComInicioIncerto(impressora, status);
      if (inicioReconciliado) return status;
      await this.sincronizarPedidoComStatus(impressora, status);
      return status;
    } catch (error) {
      await this.impressoraRepository.update(impressoraId, {
        ultimoErro: mensagemErro(error, "Falha ao sincronizar status da impressora."),
        ultimaSincronizacao: agoraSql(),
      });
      return null;
    }
  }

  /** Consome somente a ordem já persistida em pedido_impressora. */
  async tentarAtribuirAutomaticamente(): Promise<{ pedidoId: number; impressoraId: number }[]> {
    const atribuicoes: { pedidoId: number; impressoraId: number }[] = [];
    let reserva = await this.pedidoImpressoraRepository.reservarProximaAlocacao();

    if (!reserva && await this.pedidoImpressoraRepository.possuiPedidosPendentesSemPlano()) {
      await this.filaService.reescalonarFilaVirtual();
      reserva = await this.pedidoImpressoraRepository.reservarProximaAlocacao();
    }

    for (
      let processadas = 0;
      reserva && processadas < MAX_ALOCACOES_POR_VARREDURA;
      processadas += 1
    ) {
      try {
        await this.iniciarReserva(reserva);
        atribuicoes.push({ pedidoId: reserva.idPedido, impressoraId: reserva.idImpressora });
      } catch (error) {
        console.error(
          `[ORQUESTRADOR] Falha ao iniciar alocação ${reserva.idAlocacao} ` +
            `(pedido ${reserva.idPedido}, impressora ${reserva.idImpressora}):`,
          mensagemErro(error, "erro desconhecido"),
        );
      }
      reserva = await this.pedidoImpressoraRepository.reservarProximaAlocacao();
    }

    if (atribuicoes.length > 0) {
      console.log(
        `[ORQUESTRADOR] ${atribuicoes.length} alocação(ões) da fila oficial iniciada(s).`,
      );
    }
    return atribuicoes;
  }

  /**
   * Gatilho de replanejamento por evento (Fase 4): quando uma impressora
   * fica indisponível (Erro/Manutenção/Indisponível/Aguardando Remoção) —
   * seja por falha detectada pelo monitor Moonraker, seja por ação do admin
   * — qualquer plano futuro (`na_fila`/`aguardando_filamento`) ainda preso a
   * ela é invalidado e a fila é reavaliada imediatamente, em vez de esperar
   * a varredura periódica. Não mexe em reservas/execuções ativas, que já têm
   * seu próprio tratamento de falha.
   */
  async reagirAImpressoraIndisponivel(idImpressora: number): Promise<void> {
    try {
      const invalidados =
        await this.pedidoImpressoraRepository.invalidarPlanejamentoDaImpressora(idImpressora);
      if (invalidados > 0) {
        console.log(
          `[ORQUESTRADOR] ${invalidados} alocação(ões) futura(s) da impressora ${idImpressora} ` +
            "invalidada(s) após indisponibilidade; replanejando.",
        );
      }
      await this.filaService.reescalonarFilaVirtual();
      await this.tentarAtribuirAutomaticamente();
    } catch (error) {
      console.error(
        `[ORQUESTRADOR] Falha ao reagir à indisponibilidade da impressora ${idImpressora}:`,
        mensagemErro(error, "erro desconhecido"),
      );
    }
  }

  async atribuirPedido(impressoraId: number, pedidoId: number): Promise<AssignPrintJobResult> {
    let reserva = await this.pedidoImpressoraRepository.reservarAlocacao(
      impressoraId,
      pedidoId,
    );

    if (!reserva && await this.pedidoImpressoraRepository.possuiPedidosPendentesSemPlano()) {
      await this.filaService.reescalonarFilaVirtual();
      reserva = await this.pedidoImpressoraRepository.reservarAlocacao(
        impressoraId,
        pedidoId,
      );
    }

    if (!reserva) {
      const planejada = await this.pedidoImpressoraRepository.listarPlano({
        idPedido: pedidoId,
        status: ["na_fila", "reservado", "aguardando_filamento", "em_impressao"],
      });
      if (planejada[0]?.status === "aguardando_filamento") {
        throw new Error("A alocação está aguardando o filamento correto e não pode ser iniciada.");
      }
      throw new Error(
        "Não existe alocação executável planejada para este pedido e esta impressora.",
      );
    }

    return this.iniciarReserva(reserva);
  }

  private async iniciarReserva(reserva: ReservaAlocacao): Promise<AssignPrintJobResult> {
    let inicioPodeTerSidoAceito = false;
    let identificadorInicioPossivel: string | null = null;
    let inicioConfirmadoFisicamente = false;
    let statusFisicoConfirmado: string | null = null;
    let impressora: Impressora | null = null;

    try {
      const pedido = await this.obterPedidoReservadoOuFalhar(reserva.idPedido);
      impressora = await this.obterImpressoraOuFalhar(reserva.idImpressora);
      if (
        impressora.status !== "Reservada" ||
        impressora.idPedidoAtual !== reserva.idPedido
      ) {
        throw new Error("A reserva da impressora não corresponde à alocação planejada.");
      }
      if (!pedido.gcodePath) {
        throw new Error("G-code ainda não foi gerado para este pedido.");
      }

      const caminhoGcode = path.resolve(pedido.gcodePath);
      await access(caminhoGcode, constants.R_OK);
      const conteudo = await readFile(caminhoGcode);
      const nomeArquivo = `pedido_${pedido.id}.gcode`;

      const slot = this.localizarSlotElegivel(impressora, pedido.idMaterial);
      if (!slot) {
        const mensagem =
          `Pedido ${pedido.id} aguardando o material ${pedido.idMaterial}; ` +
          `nenhum slot elegível o contém.`;
        await this.pedidoImpressoraRepository.marcarAguardandoFilamento(
          reserva.idAlocacao,
          mensagem,
        );
        throw new AguardandoFilamentoError(mensagem);
      }
      if (slot.numeroSlot !== reserva.numeroSlotPlanejado) {
        await this.pedidoImpressoraRepository.atualizarSlotReservado(
          reserva.idAlocacao,
          slot.numeroSlot,
        );
      }

      const controle = this.adapterFactory.getAdapter(impressora.api);
      let comunicacao: PrinterStartJobResult;

      if (impressora.possuiCfs) {
        const inicioCfs = await this.iniciarComCfs(
          impressora,
          pedido,
          slot,
          caminhoGcode,
          nomeArquivo,
          conteudo,
          controle,
          (podeTerIniciado, identificador) => {
            inicioPodeTerSidoAceito = podeTerIniciado;
            identificadorInicioPossivel = podeTerIniciado ? identificador ?? null : null;
          },
        );
        comunicacao = inicioCfs.comunicacao;
        inicioConfirmadoFisicamente = inicioCfs.confirmadoFisicamente;
        statusFisicoConfirmado = inicioCfs.statusFisico;
      } else {
        const health = await controle.healthCheck(impressora);
        if (!health.ok) throw new Error(health.mensagem);
        await this.validarPreFlightFisicoOcioso(controle, impressora);

        inicioPodeTerSidoAceito = true;
        const resultado = await controle.uploadAndStart(impressora, { nomeArquivo, conteudo });
        if (!resultado.ok) {
          inicioPodeTerSidoAceito = false;
          identificadorInicioPossivel = null;
          throw new Error(resultado.mensagem);
        }
        identificadorInicioPossivel =
          resultado.jobRemotoId ?? resultado.nomeArquivoRemoto ?? nomeArquivo;
        const statusConfirmado = await this.confirmarInicioFisico(
          controle,
          impressora,
          {
            jobRemotoId: resultado.jobRemotoId ?? null,
            nomeArquivoRemoto: resultado.nomeArquivoRemoto ?? nomeArquivo,
          },
        );
        comunicacao = {
          ...resultado,
          rawStatus: statusConfirmado.detalhes ?? resultado.rawStatus,
        };
        inicioConfirmadoFisicamente = true;
        statusFisicoConfirmado = statusConfirmado.statusFisico;
      }

      try {
        await this.pedidoImpressoraRepository.confirmarInicio(reserva.idAlocacao, {
          jobRemotoId: comunicacao.jobRemotoId ?? null,
          statusFisico: statusFisicoConfirmado,
          horasConsumidas: pedido.tempoGcodeHoras ?? 0,
        });
      } catch (error) {
        // O equipamento pode estar imprimindo. Mantemos a alocação reservada e
        // bloqueamos a impressora para que nenhum worker faça um segundo envio.
        const mensagem =
          `Início físico confirmado, mas a persistência transacional falhou: ` +
          mensagemErro(error, "erro desconhecido");
        await this.pedidoImpressoraRepository.bloquearReservaComInicioIncerto(
          reserva.idAlocacao,
          mensagem,
          { jobRemotoId: identificadorInicioPossivel },
        );
        throw new InicioFisicoIncertoError(mensagem);
      }

      // Marca a próxima unidade física (job) deste pedido como iniciada
      // nesta impressora (Fase 6). Best-effort: pedidos sem jobs cadastrados
      // (fluxo anterior à Fase 6) continuam funcionando normalmente.
      await this.jobImpressaoRepository
        .marcarProximoEmImpressao(pedido.id, impressora.id)
        .catch((err) =>
          console.error(
            `[ORQUESTRADOR] Falha ao marcar job em execução (pedido ${pedido.id}):`,
            mensagemErro(err, "erro desconhecido"),
          ),
        );

      await this.notificarImpressaoIniciada(pedido.id);

      return {
        impressora: await this.obterImpressoraOuFalhar(impressora.id),
        pedidoId: pedido.id,
        comunicacao,
      };
    } catch (error) {
      if (error instanceof AguardandoFilamentoError) {
        if (impressora) {
          const pedidoAguardando = await this.pedidoRepository.findById(reserva.idPedido);
          await emailAguardandoFilamento({
            id: reserva.idPedido,
            nome: pedidoAguardando?.nome ?? `Pedido ${reserva.idPedido}`,
            nomeUsuario: pedidoAguardando?.nomeUsuario,
            emailUsuario: pedidoAguardando?.emailUsuario,
            impressora: impressora.nome,
            motivo: error.message,
          });
        }
        throw error;
      }
      if (inicioConfirmadoFisicamente) {
        if (error instanceof InicioFisicoIncertoError) throw error;
        throw new InicioFisicoIncertoError(
          mensagemErro(error, "Falha após o início físico confirmado."),
        );
      }

      const mensagem = mensagemErro(error, "Falha desconhecida antes do início físico.");
      if (inicioPodeTerSidoAceito || error instanceof InicioFisicoIncertoError) {
        await this.pedidoImpressoraRepository.bloquearReservaComInicioIncerto(
          reserva.idAlocacao,
          mensagem,
          { jobRemotoId: identificadorInicioPossivel },
        );
      } else {
        const resultadoFalha = await this.pedidoImpressoraRepository.marcarFalhaAntesDoInicio(
          reserva.idAlocacao,
          mensagem,
          {
            maxTentativas: falhaNaoRecuperavel(error) ? 1 : 3,
            bloquearImpressora: false,
          },
        );
        if (resultadoFalha.status === "falhou") {
          await this.notificarPedidoFalhou(reserva.idPedido, mensagem);
        }
      }
      if (impressora) {
        await emailImpressoraErro({
          id: impressora.id,
          nome: impressora.nome,
          modelo: impressora.modelo,
          ultimoErro: mensagem,
        });
        // Se esta falha derrubou a impressora (ou ela já estava incerta),
        // qualquer plano futuro preso a ela precisa ser reavaliado agora, não
        // só na próxima varredura periódica.
        this.reagirAImpressoraIndisponivel(impressora.id).catch(() => {});
      }
      throw error instanceof Error ? error : new Error(mensagem);
    }
  }

  private async iniciarComCfs(
    impressora: Impressora,
    pedido: Pedido,
    slot: SlotFilamento,
    caminhoGcode: string,
    nomeArquivo: string,
    conteudo: Buffer,
    controle: IPrinterCommunicationAdapter,
    registrarPossivelInicio: (value: boolean, identificador?: string | null) => void,
  ): Promise<{
    comunicacao: PrinterStartJobResult;
    confirmadoFisicamente: true;
    statusFisico: string;
  }> {
    const adapterCfs = this.adapterFactory.getCfsAdapter(impressora);
    let inventario: CfsInventory;
    if (adapterCfs.tipo === "DUMMY_CFS") {
      try {
        // Preserva inventários sanitizados injetados por testes; o fallback
        // abaixo existe apenas para as impressoras DUMMY do seed local.
        inventario = await adapterCfs.consultarInventarioCfs(impressora);
      } catch (error) {
        if (!(error instanceof CfsPrintAdapterError) || error.code !== "CFS_INVENTORY_UNAVAILABLE") {
          throw error;
        }
        adapterCfs.configurarInventarioCfs?.(impressora.id, {
          itens: impressora.filamentosCarregados.map((carregado) => ({
            numeroSlot: carregado.numeroSlot,
            boxId: `dummy-box-${impressora.id}`,
            deviceMaterialId:
              `dummy-device-material-${impressora.id}-${carregado.numeroSlot}`,
            tipoMaterial: carregado.material.tipo,
            cor: carregado.material.cor,
          })),
          consultadoEm: new Date().toISOString(),
        });
        inventario = await adapterCfs.consultarInventarioCfs(impressora);
      }
    } else {
      inventario = await adapterCfs.consultarInventarioCfs(impressora);
    }
    const itemFisico = inventario.itens.find(
      (item) => item.numeroSlot === slot.numeroSlot,
    );
    this.validarInventarioFisico(slot, itemFisico);

    const extrusorLogico = validarExtrusorLogicoMonomaterial(
      conteudo.toString("utf8"),
    );
    const health = await controle.healthCheck(impressora);
    if (!health.ok) throw new Error(health.mensagem);
    await this.validarPreFlightFisicoOcioso(controle, impressora);

    const submissao = {
      caminhoGcode,
      nomeArquivo,
      openCfs: true as const,
      filamentos: [{
        extrusorLogico,
        materialPlanejado: {
          idMaterialBanco: pedido.idMaterial,
          numeroSlot: slot.numeroSlot,
        },
        enderecoFisico: {
          numeroSlot: itemFisico!.numeroSlot,
          boxId: itemFisico!.boxId,
          deviceMaterialId: itemFisico!.deviceMaterialId,
        },
        tipoMaterial: itemFisico!.tipoMaterial,
        cor: itemFisico!.cor,
      }],
    };
    registrarPossivelInicio(true);
    const resultado = await adapterCfs.enviarEIniciarComMapeamento(impressora, submissao);
    registrarPossivelInicio(
      true,
      resultado.jobRemotoId ?? resultado.nomeArquivoRemoto ?? nomeArquivo,
    );

    this.validarCoerenciaResultadoCfs(resultado);
    if (!resultado.aceito) {
      registrarPossivelInicio(false);
      throw new Error(resultado.mensagem);
    }
    this.validarMapeamentoCfsAplicado(submissao.filamentos, resultado.mapeamentoAplicado);
    if (adapterCfs.tipo === "DUMMY_CFS") {
      const jobRemotoId = resultado.jobRemotoId?.trim();
      if (!jobRemotoId || !controle.registrarInicioExternoSimulado) {
        throw new CfsPrintAdapterError(
          "CFS_MAPPING_INVALID",
          "O fluxo DUMMY CFS aceito não forneceu um job simulável para confirmação física.",
        );
      }
      controle.registrarInicioExternoSimulado(impressora, jobRemotoId);
    }

    // O booleano do protocolo de submissão não substitui a observação do
    // estado físico. Moonraker (ou o controle DUMMY) precisa confirmar o job.
    const statusConfirmado = await this.confirmarInicioFisico(controle, impressora, {
      jobRemotoId: resultado.jobRemotoId ?? null,
      nomeArquivoRemoto: resultado.nomeArquivoRemoto ?? nomeArquivo,
    });

    return {
      confirmadoFisicamente: true,
      statusFisico: statusConfirmado.statusFisico,
      comunicacao: {
        ok: true,
        mensagem: resultado.mensagem,
        jobRemotoId: resultado.jobRemotoId ?? null,
        nomeArquivoRemoto: resultado.nomeArquivoRemoto ?? nomeArquivo,
        rawStatus: statusConfirmado.detalhes ?? resultado.rawStatus,
      },
    };
  }

  private validarCoerenciaResultadoCfs(resultado: CfsPrintStartResult): void {
    if (
      typeof resultado.ok !== "boolean" ||
      typeof resultado.aceito !== "boolean" ||
      typeof resultado.confirmadoFisicamente !== "boolean"
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O adapter CFS retornou indicadores de aceite inválidos.",
      );
    }
    if (
      (resultado.aceito && !resultado.ok) ||
      (resultado.confirmadoFisicamente && (!resultado.ok || !resultado.aceito))
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O adapter CFS retornou um estado incoerente de aceite/confirmação; a reserva foi bloqueada.",
      );
    }
  }

  private validarMapeamentoCfsAplicado(
    solicitado: readonly CfsFilamentMapping[],
    aplicado: readonly CfsFilamentMapping[],
  ): void {
    if (!Array.isArray(aplicado) || aplicado.length !== solicitado.length) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O mapeamento informado como aplicado pelo CFS diverge do mapeamento solicitado.",
      );
    }

    const divergente = solicitado.some((esperado, indice) => {
      const observado = aplicado[indice];
      if (!observado || !observado.materialPlanejado || !observado.enderecoFisico) return true;
      return (
        observado.extrusorLogico !== esperado.extrusorLogico ||
        observado.materialPlanejado.idMaterialBanco !==
          esperado.materialPlanejado.idMaterialBanco ||
        observado.materialPlanejado.numeroSlot !== esperado.materialPlanejado.numeroSlot ||
        observado.enderecoFisico.numeroSlot !== esperado.enderecoFisico.numeroSlot ||
        String(observado.enderecoFisico.boxId) !== String(esperado.enderecoFisico.boxId) ||
        String(observado.enderecoFisico.deviceMaterialId) !==
          String(esperado.enderecoFisico.deviceMaterialId) ||
        !textosOpcionaisCorrespondem(observado.tipoMaterial, esperado.tipoMaterial) ||
        !textosOpcionaisCorrespondem(observado.cor, esperado.cor)
      );
    });
    if (divergente) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O mapeamento informado como aplicado pelo CFS diverge do mapeamento solicitado.",
      );
    }
  }

  private validarInventarioFisico(
    slot: SlotFilamento,
    item: CfsInventoryItem | undefined,
  ): asserts item is CfsInventoryItem {
    if (!item) {
      throw new CfsPrintAdapterError(
        "CFS_SLOT_NOT_FOUND",
        `O slot ${slot.numeroSlot} do banco não existe no inventário físico atual.`,
      );
    }
    if (!item.tipoMaterial || !item.cor) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `O inventário físico do slot ${slot.numeroSlot} não informa tipo e cor verificáveis.`,
      );
    }
    if (
      textoComparavel(item.tipoMaterial) !== textoComparavel(slot.material.tipo) ||
      textoComparavel(item.cor) !== textoComparavel(slot.material.cor)
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `Divergência entre banco e inventário físico no slot ${slot.numeroSlot}; ` +
          "a impressão foi bloqueada.",
      );
    }
  }

  private localizarSlotElegivel(
    impressora: Impressora,
    idMaterial: number,
  ): SlotFilamento | null {
    const elegiveis = impressora.filamentosCarregados
      .filter((slot) => impressora.possuiCfs || slot.numeroSlot === 1)
      .filter((slot) => slot.material.id === idMaterial)
      .sort((a, b) => a.numeroSlot - b.numeroSlot);
    return elegiveis[0] ?? null;
  }

  private async validarPreFlightFisicoOcioso(
    adapter: IPrinterCommunicationAdapter,
    impressora: Impressora,
  ): Promise<void> {
    const status = await adapter.getStatus(impressora);
    if (status.statusDominio !== "Ociosa") {
      throw new InicioFisicoIncertoError(
        `A impressora ${impressora.id} não está fisicamente ociosa antes do envio ` +
          `(estado: ${status.statusFisico}).`,
      );
    }
  }

  private async confirmarInicioFisico(
    adapter: IPrinterCommunicationAdapter,
    impressora: Impressora,
    identificadores: IdentificadoresInicioEsperados,
  ): Promise<PrinterRuntimeStatus> {
    const timeoutConfigurado = Number(
      process.env.PRINTER_START_CONFIRM_TIMEOUT_MS ?? CONFIRMACAO_INICIO_TIMEOUT_MS,
    );
    const timeoutMs = Number.isFinite(timeoutConfigurado) && timeoutConfigurado > 0
      ? timeoutConfigurado
      : CONFIRMACAO_INICIO_TIMEOUT_MS;
    const inicio = Date.now();
    const identificadoresEsperados = [
      identificadores.jobRemotoId,
      identificadores.nomeArquivoRemoto,
    ].filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    let ultimoJobDivergente: string | null = null;

    do {
      // O timeout HTTP de cada chamada de status não pode ser deixado igual
      // ao timeoutMs configurado da impressora: se ambos coincidirem (ex.:
      // os dois em 15000ms), uma única chamada lenta consome sozinha todo o
      // orçamento de confirmação e o início físico é declarado incerto mesmo
      // com a impressão em andamento. Cada chamada de polling usa o menor
      // entre o timeout configurado, um teto fixo e o tempo restante do
      // orçamento total, garantindo várias tentativas dentro do orçamento.
      const tempoRestanteMs = Math.max(1, timeoutMs - (Date.now() - inicio));
      const status = await adapter.getStatus({
        ...impressora,
        timeoutMs: Math.max(
          1000,
          Math.min(
            impressora.timeoutMs || CONFIRMACAO_INICIO_POLL_HTTP_TIMEOUT_MS,
            CONFIRMACAO_INICIO_POLL_HTTP_TIMEOUT_MS,
            tempoRestanteMs,
          ),
        ),
        jobRemotoId: identificadores.jobRemotoId ?? impressora.jobRemotoId,
      });
      if (status.statusDominio === "Imprimindo") {
        if (
          !status.jobRemotoId ||
          identificadoresEsperados.length === 0 ||
          identificadoresEsperados.some((esperado) =>
            identificadoresRemotosCorrespondem(status.jobRemotoId!, esperado)
          )
        ) {
          return status;
        }
        ultimoJobDivergente = status.jobRemotoId;
      }
      if (status.statusDominio === "Erro") {
        throw new InicioFisicoIncertoError(
          status.mensagem ?? `A impressora informou erro físico: ${status.statusFisico}.`,
        );
      }
      if (Date.now() - inicio >= timeoutMs) break;
      await this.aguardar(
        Math.min(CONFIRMACAO_INICIO_INTERVALO_MS, Math.max(1, timeoutMs - (Date.now() - inicio))),
      );
    } while (Date.now() - inicio < timeoutMs);

    throw new InicioFisicoIncertoError(
      ultimoJobDivergente
        ? `A impressora iniciou o job "${ultimoJobDivergente}", que não corresponde ao arquivo enviado; ` +
          "a reserva foi bloqueada para reconciliação."
        : "O comando de início pode ter sido aceito, mas a impressora não confirmou o estado Imprimindo.",
    );
  }

  async liberarImpressora(impressoraId: number): Promise<Impressora> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    if (
      impressora.status === "Reservada" ||
      (impressora.idPedidoAtual && impressora.status !== "Imprimindo")
    ) {
      throw new InicioFisicoIncertoError(
        "A impressora possui uma reserva que ainda não pode ser encerrada com segurança; " +
          "reconcilie o estado físico antes da liberação manual.",
      );
    }
    try {
      await this.adapterFactory.getAdapter(impressora.api).desligarAquecedores(impressora);
    } catch (error) {
      console.error(
        `[ORQUESTRADOR] Falha ao desligar aquecedores da impressora ${impressoraId}:`,
        mensagemErro(error, "erro desconhecido"),
      );
    }

    if (impressora.idPedidoAtual) {
      const concluido = await this.pedidoImpressoraRepository.concluirExecucao(
        impressora.id,
        impressora.idPedidoAtual,
      );
      if (concluido) {
        await this.notificarPedidoConcluido(impressora.idPedidoAtual);
      } else {
        await this.notificarSeCopiaConcluida(impressora.idPedidoAtual);
      }
    }
    return this.obterImpressoraOuFalhar(impressoraId);
  }

  /**
   * Parada manual: admin detectou um problema na impressão em andamento (ex.
   * quantidade errada, falha visível) e a interrompe antes da conclusão.
   * Cancela o job na impressora física (best-effort), devolve o pedido para
   * "na_fila" mantendo a posição original no planejamento e libera a
   * impressora para "Aguardando Remoção" até a peça malsucedida sair da mesa.
   */
  async pararImpressao(impressoraId: number): Promise<Impressora> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);

    if (impressora.status !== "Imprimindo") {
      throw new Error(
        `Só é possível parar uma impressora que está imprimindo. Status atual: "${impressora.status}".`,
      );
    }
    if (!impressora.idPedidoAtual) {
      throw new Error("Impressora está imprimindo mas não possui pedido associado.");
    }

    const adapter = this.adapterFactory.getAdapter(impressora.api);

    try {
      await adapter.cancelarImpressao(impressora);
    } catch (error) {
      console.error(
        `[ORQUESTRADOR] Falha ao cancelar impressão na impressora ${impressoraId}:`,
        mensagemErro(error, "erro desconhecido"),
      );
    }

    try {
      await adapter.desligarAquecedores(impressora);
    } catch (error) {
      console.error(
        `[ORQUESTRADOR] Falha ao desligar aquecedores da impressora ${impressoraId}:`,
        mensagemErro(error, "erro desconhecido"),
      );
    }

    const parado = await this.pedidoImpressoraRepository.pararExecucao(
      impressora.id,
      impressora.idPedidoAtual,
      `Impressão interrompida pelo administrador. Pedido ${impressora.idPedidoAtual} devolvido para a fila.`,
    );
    if (!parado) {
      throw new PedidoImpressoraStateError(
        "A execução ativa não corresponde ao pedido e à impressora — reconcilie o estado antes de tentar novamente.",
      );
    }

    return this.obterImpressoraOuFalhar(impressoraId);
  }

  async confirmarRemocao(impressoraId: number): Promise<Impressora> {
    const impressora = await this.obterImpressoraOuFalhar(impressoraId);
    if (impressora.status !== "Aguardando Remoção") {
      throw new Error(
        `Impressora não está aguardando remoção. Status atual: "${impressora.status}".`,
      );
    }
    await this.impressoraRepository.release(impressoraId, "Ociosa");
    await this.impressoraRepository.addEvent(
      impressoraId,
      "release",
      "Peça removida. Impressora liberada para novos pedidos.",
    );
    return this.obterImpressoraOuFalhar(impressoraId);
  }

  async listarEventos(impressoraId: number, limit = 20) {
    await this.obterImpressoraOuFalhar(impressoraId);
    return this.impressoraRepository.listEvents(impressoraId, limit);
  }

  private async obterPedidoReservadoOuFalhar(pedidoId: number): Promise<Pedido> {
    const pedido = await this.pedidoRepository.findById(pedidoId);
    if (!pedido) throw new Error("Pedido não encontrado após a reserva.");
    if (pedido.status !== "na_fila") {
      throw new Error(
        `Pedido reservado deixou de estar na fila. Status atual: "${pedido.status}".`,
      );
    }
    return pedido;
  }

  private async obterImpressoraOuFalhar(impressoraId: number): Promise<Impressora> {
    const impressora = await this.impressoraRepository.findById(impressoraId);
    if (!impressora) throw new Error("Impressora não encontrada.");
    return impressora;
  }

  private async persistirStatusFisico(
    impressora: Impressora,
    status: PrinterRuntimeStatus,
  ): Promise<void> {
    const preservarErroOperacional = this.possuiReservaComInicioIncerto(impressora);
    await this.impressoraRepository.update(impressora.id, {
      statusFisico: status.statusFisico,
      ...(preservarErroOperacional ? {} : { jobRemotoId: status.jobRemotoId ?? null }),
      ...(preservarErroOperacional && status.statusDominio !== "Erro"
        ? {}
        : {
            ultimoErro:
              status.statusDominio === "Erro"
                ? status.mensagem ?? "Erro informado pela impressora."
                : null,
          }),
      // tempo_para_ficar_livre_horas refinado com o tempo restante real
      // reportado pelo Moonraker, sempre que a impressora ainda está
      // efetivamente imprimindo o job atual (nunca sobrescreve um estado
      // incerto/reservado com um número inventado).
      ...(impressora.status === "Imprimindo" &&
      status.statusDominio === "Imprimindo" &&
      status.tempoRestanteS != null
        ? { tempoParaFicarLivreHoras: Math.max(0, status.tempoRestanteS / 3600) }
        : {}),
      ultimaSincronizacao: agoraSql(),
    });
  }

  private possuiReservaComInicioIncerto(impressora: Impressora): boolean {
    return impressora.status === "Erro" && Boolean(impressora.idPedidoAtual);
  }

  private async reconciliarReservaComInicioIncerto(
    impressora: Impressora,
    status: PrinterRuntimeStatus,
  ): Promise<boolean> {
    if (
      impressora.status !== "Erro" ||
      !impressora.idPedidoAtual ||
      status.statusDominio !== "Imprimindo" ||
      !impressora.jobRemotoId ||
      !status.jobRemotoId ||
      !identificadoresRemotosCorrespondem(status.jobRemotoId, impressora.jobRemotoId)
    ) {
      return false;
    }

    const [alocacao] = await this.pedidoImpressoraRepository.listarPlano({
      idImpressora: impressora.id,
      idPedido: impressora.idPedidoAtual,
      status: "reservado",
    });
    if (!alocacao) return false;

    const pedido = await this.pedidoRepository.findById(impressora.idPedidoAtual);
    if (!pedido || pedido.status !== "na_fila") return false;

    await this.pedidoImpressoraRepository.reconciliarInicioConfirmado(alocacao.id, {
      jobRemotoId: status.jobRemotoId ?? impressora.jobRemotoId,
      statusFisico: status.statusFisico,
      horasConsumidas: pedido.tempoGcodeHoras ?? 0,
    });
    return true;
  }

  private async sincronizarPedidoComStatus(
    impressora: Impressora,
    status: PrinterRuntimeStatus,
  ): Promise<void> {
    if (impressora.status !== "Imprimindo" || !impressora.idPedidoAtual) return;

    if (status.statusDominio === "Erro") {
      const motivo = status.mensagem ?? `Falha física: ${status.statusFisico}.`;
      const falhou = await this.pedidoImpressoraRepository.falharExecucao(
        impressora.id,
        impressora.idPedidoAtual,
        motivo,
      );
      // A impressora acabou de virar 'Erro'. Qualquer job futuro que já
      // estivesse planejado para ela (ex.: K2 com unidade atual + unidades
      // futuras da fila) não pode continuar preso a uma máquina quebrada —
      // reavalia agora em vez de esperar a varredura periódica.
      this.reagirAImpressoraIndisponivel(impressora.id).catch(() => {});
      if (falhou) await this.notificarPedidoFalhou(impressora.idPedidoAtual, motivo);
      return;
    }
    if (status.statusDominio !== "Ociosa") return;

    try {
      await this.adapterFactory.getAdapter(impressora.api).desligarAquecedores(impressora);
    } catch (error) {
      console.error(
        `[ORQUESTRADOR] Falha ao desligar aquecedores da impressora ${impressora.id}:`,
        mensagemErro(error, "erro desconhecido"),
      );
    }
    const concluido = await this.pedidoImpressoraRepository.concluirExecucao(
      impressora.id,
      impressora.idPedidoAtual,
      "A impressora voltou para ociosa após concluir ou encerrar o trabalho.",
    );
    if (concluido) {
      console.log(
        `[ORQUESTRADOR] Pedido ${impressora.idPedidoAtual} concluído; ` +
          `impressora ${impressora.id} aguardando remoção.`,
      );
      await this.notificarPedidoConcluido(impressora.idPedidoAtual);
    } else {
      await this.notificarSeCopiaConcluida(impressora.idPedidoAtual);
    }
  }

  /**
   * Chamado quando concluirExecucao() retorna false — ou uma unidade
   * intermediária de um pedido com quantidade > 1 acabou de terminar
   * (ainda há jobs pendentes em jobs_impressao), ou a chamada não se
   * aplicou (linha já finalizada por outro caminho). Consulta os jobs
   * reais (Fase 6 do João) pra decidir qual dos dois casos é este —
   * evita duplicar contagem de progresso no lado do pedido.
   */
  private async notificarSeCopiaConcluida(pedidoId: number): Promise<void> {
    const pedido = await this.pedidoRepository.findById(pedidoId);
    if (!pedido || !pedido.emailUsuario || pedido.quantidade <= 1) return;
    const pendentes = await this.jobImpressaoRepository.contarPendentes(pedidoId);
    if (pendentes <= 0 || pendentes >= pedido.quantidade) return;
    await emailClienteCopiaConcluida({
      nome: pedido.nome,
      nomeUsuario: pedido.nomeUsuario,
      emailUsuario: pedido.emailUsuario,
      copiaAtual: pedido.quantidade - pendentes,
      totalCopias: pedido.quantidade,
    });
  }

  private async notificarPedidoConcluido(pedidoId: number): Promise<void> {
    const pedido = await this.pedidoRepository.findById(pedidoId);
    if (!pedido) return;
    await emailPedidoConcluido({
      id: pedido.id,
      nome: pedido.nome,
      nomeUsuario: pedido.nomeUsuario,
      emailUsuario: pedido.emailUsuario,
      preco: pedido.preco,
      tempoEstimadoS: pedido.tempoEstimadoS,
      materialGramas: pedido.materialGramas,
    });
    if (pedido.emailUsuario) {
      await emailClientePecaPronta({
        nome: pedido.nome,
        nomeUsuario: pedido.nomeUsuario,
        emailUsuario: pedido.emailUsuario,
      });
    }
  }

  private async notificarImpressaoIniciada(pedidoId: number): Promise<void> {
    const pedido = await this.pedidoRepository.findById(pedidoId);
    if (!pedido || !pedido.emailUsuario) return;
    await emailClienteImpressaoIniciada({
      nome: pedido.nome,
      nomeUsuario: pedido.nomeUsuario,
      emailUsuario: pedido.emailUsuario,
    });
  }

  private async notificarPedidoFalhou(pedidoId: number, motivo: string): Promise<void> {
    const pedido = await this.pedidoRepository.findById(pedidoId);
    if (!pedido || !pedido.emailUsuario) return;
    await emailClientePedidoFalhou({
      nome: pedido.nome,
      nomeUsuario: pedido.nomeUsuario,
      emailUsuario: pedido.emailUsuario,
      motivo,
    });
  }
}
