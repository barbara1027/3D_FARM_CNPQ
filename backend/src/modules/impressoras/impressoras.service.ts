import {
  ApiProtocol,
  DeleteImpressoraResult,
  DeleteSlotResult,
  Impressora,
  ImpressoraRepository,
  ImpressoraRepositoryStateError,
  PrinterStatus,
  SlotFilamentoInput,
  UpsertSlotResult,
} from "./impressoras.repository";
import { MaterialRepository } from "../materiais/materiais.repository";
import { ArquivoRepository } from "../arquivos/arquivos.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import { PrinterAdapterFactory } from "./comunicacao/printer-adapter.factory";
import { ImpressoraOrquestradorService } from "./comunicacao/orquestrador.service";
import { PrinterHealthCheckResult } from "./comunicacao/tipos";
import { PedidoImpressoraStateError } from "../fila/pedidoImpressora.repository";

export interface ProgressoImpressora {
  progressoPct: number | null;
  tempoRestanteS: number | null;
  statusFisico: string;
}

export interface ReplanejadorFila {
  reescalonarFilaVirtual(): Promise<unknown>;
}

const REPLANEJADOR_FILA_NOOP: ReplanejadorFila = {
  async reescalonarFilaVirtual(): Promise<void> {},
};

export interface CreateImpressoraServiceDTO {
  nome: string;
  modelo: string;
  status?: PrinterStatus;
  ip?: string | null;
  baseUrl?: string | null;
  api: ApiProtocol;
  api_key?: string | null;
  timeoutMs?: number;
  possuiCfs: boolean;
  larguraMesaMm: number;
  profundidadeMesaMm: number;
  filamentosCarregados?: SlotFilamentoInput[];
  eficiencia?: number;
  taxaErroRecente?: number;
  tempoParaFicarLivreHoras?: number;
  capacidadeDiaHoras?: number;
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
  possuiCfs?: boolean;
  larguraMesaMm?: number;
  profundidadeMesaMm?: number;
  eficiencia?: number;
  taxaErroRecente?: number;
  tempoParaFicarLivreHoras?: number;
  capacidadeDiaHoras?: number;
}

export class ImpressoraServiceError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "ImpressoraServiceError";
  }
}

const API_PROTOCOLS = new Set<ApiProtocol>(["OCTOPRINT", "MOONRAKER", "DUMMY"]);
const PRINTER_STATUSES = new Set<PrinterStatus>([
  "Ociosa",
  "Reservada",
  "Imprimindo",
  "Pausada",
  "Indisponivel",
  "Aguardando Remoção",
  "Erro",
  "Manutenção",
]);

function erroValidacao(message: string): never {
  throw new ImpressoraServiceError(message, 400);
}

function validarTextoObrigatorio(value: unknown, campo: string): void {
  if (typeof value !== "string" || value.trim() === "") {
    erroValidacao(`O campo ${campo} deve ser uma string não vazia.`);
  }
}

function validarTextoNullableOpcional(value: unknown, campo: string): void {
  if (value !== undefined && value !== null && typeof value !== "string") {
    erroValidacao(`O campo ${campo} deve ser uma string ou nulo.`);
  }
}

function validarNumero(
  value: unknown,
  campo: string,
  regra: (numero: number) => boolean,
  descricao: string,
): void {
  if (typeof value !== "number" || !Number.isFinite(value) || !regra(value)) {
    erroValidacao(`O campo ${campo} ${descricao}.`);
  }
}

function validarNumeroOpcional(
  value: unknown,
  campo: string,
  regra: (numero: number) => boolean,
  descricao: string,
): void {
  if (value !== undefined) validarNumero(value, campo, regra, descricao);
}

function validarNumeroSlot(numeroSlot: unknown): asserts numeroSlot is number {
  if (
    typeof numeroSlot !== "number" ||
    !Number.isInteger(numeroSlot) ||
    numeroSlot < 1 ||
    numeroSlot > 4
  ) {
    erroValidacao("O número do slot deve ser um inteiro entre 1 e 4.");
  }
}

function validarIdMaterial(idMaterial: unknown): asserts idMaterial is number {
  if (typeof idMaterial !== "number" || !Number.isSafeInteger(idMaterial) || idMaterial <= 0) {
    erroValidacao("idMaterial deve ser um inteiro positivo.");
  }
}

function isMissingReferencedRow(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const mysqlError = error as { code?: unknown; errno?: unknown };
  return mysqlError.code === "ER_NO_REFERENCED_ROW_2" || mysqlError.errno === 1452;
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

  constructor(
    private readonly impressoraRepository: ImpressoraRepository,
    private readonly materialRepository: MaterialRepository = new MaterialRepository(),
    private readonly replanejadorFila: ReplanejadorFila = REPLANEJADOR_FILA_NOOP,
  ) {}

  private validarCamposComuns(data: CreateImpressoraServiceDTO | UpdateImpressoraServiceDTO): void {
    if (data.nome !== undefined) validarTextoObrigatorio(data.nome, "nome");
    if (data.modelo !== undefined) validarTextoObrigatorio(data.modelo, "modelo");
    if (data.api !== undefined && !API_PROTOCOLS.has(data.api)) {
      erroValidacao("O campo api possui um protocolo inválido.");
    }
    if (data.status !== undefined && !PRINTER_STATUSES.has(data.status)) {
      erroValidacao("O campo status possui um valor inválido.");
    }
    if (data.possuiCfs !== undefined && typeof data.possuiCfs !== "boolean") {
      erroValidacao("O campo possuiCfs deve ser booleano.");
    }
    validarTextoNullableOpcional(data.ip, "ip");
    validarTextoNullableOpcional(data.baseUrl, "baseUrl");
    validarTextoNullableOpcional(data.api_key, "api_key");
    validarNumeroOpcional(data.larguraMesaMm, "larguraMesaMm", (numero) => numero > 0, "deve ser um número maior que zero");
    validarNumeroOpcional(data.profundidadeMesaMm, "profundidadeMesaMm", (numero) => numero > 0, "deve ser um número maior que zero");
    validarNumeroOpcional(data.timeoutMs, "timeoutMs", (numero) => Number.isSafeInteger(numero) && numero > 0, "deve ser um inteiro positivo");
    validarNumeroOpcional(data.eficiencia, "eficiencia", (numero) => numero > 0, "deve ser um número maior que zero");
    validarNumeroOpcional(data.taxaErroRecente, "taxaErroRecente", (numero) => numero >= 0 && numero <= 1, "deve estar entre zero e um");
    validarNumeroOpcional(data.tempoParaFicarLivreHoras, "tempoParaFicarLivreHoras", (numero) => numero >= 0, "deve ser um número maior ou igual a zero");
    validarNumeroOpcional(data.capacidadeDiaHoras, "capacidadeDiaHoras", (numero) => numero > 0, "deve ser um número maior que zero");
  }

  private validarCriacao(data: CreateImpressoraServiceDTO): SlotFilamentoInput[] {
    validarTextoObrigatorio(data.nome, "nome");
    validarTextoObrigatorio(data.modelo, "modelo");
    if (!API_PROTOCOLS.has(data.api)) erroValidacao("O campo api possui um protocolo inválido.");
    if (typeof data.possuiCfs !== "boolean") erroValidacao("O campo possuiCfs deve ser booleano.");
    validarNumero(data.larguraMesaMm, "larguraMesaMm", (numero) => numero > 0, "deve ser um número maior que zero");
    validarNumero(data.profundidadeMesaMm, "profundidadeMesaMm", (numero) => numero > 0, "deve ser um número maior que zero");
    this.validarCamposComuns(data);
    return this.validarSlotsCriacao(data.filamentosCarregados, data.possuiCfs);
  }

  private validarSlotsCriacao(value: unknown, possuiCfs: boolean): SlotFilamentoInput[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) erroValidacao("filamentosCarregados deve ser um array.");

    const slots: SlotFilamentoInput[] = [];
    const numerosUsados = new Set<number>();
    for (const item of value) {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        erroValidacao("Cada filamento carregado deve informar numeroSlot e idMaterial.");
      }
      const slot = item as Record<string, unknown>;
      validarNumeroSlot(slot.numeroSlot);
      validarIdMaterial(slot.idMaterial);
      if (numerosUsados.has(slot.numeroSlot)) {
        erroValidacao(`O slot ${slot.numeroSlot} foi informado mais de uma vez.`);
      }
      numerosUsados.add(slot.numeroSlot);
      slots.push({ numeroSlot: slot.numeroSlot, idMaterial: slot.idMaterial });
    }

    if (!possuiCfs && slots.some((slot) => slot.numeroSlot !== 1)) {
      throw new ImpressoraServiceError(
        "Impressoras sem CFS podem utilizar somente o slot 1.",
        409,
      );
    }
    return slots;
  }

  private async validarMateriaisExistentes(slots: SlotFilamentoInput[]): Promise<void> {
    for (const idMaterial of new Set(slots.map((slot) => slot.idMaterial))) {
      if (!(await this.materialRepository.findById(idMaterial))) {
        throw new ImpressoraServiceError(`Material ${idMaterial} não encontrado.`, 404);
      }
    }
  }

  private async obterImpressoraOuFalhar(id: number): Promise<Impressora> {
    const impressora = await this.impressoraRepository.findById(id);
    if (!impressora) throw new ImpressoraServiceError("Impressora não encontrada.", 404);
    return impressora;
  }

  async listar(): Promise<Impressora[]> {
    return this.impressoraRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Impressora | null> {
    return this.impressoraRepository.findById(id);
  }

  async criar(data: CreateImpressoraServiceDTO): Promise<Impressora> {
    const slots = this.validarCriacao(data);
    await this.validarMateriaisExistentes(slots);
    let id: number;
    try {
      id = await this.impressoraRepository.create({
        ...data,
        filamentosCarregados: slots,
        status: data.status ?? "Ociosa",
        timeoutMs: data.timeoutMs ?? 15000,
      });
    } catch (error) {
      if (isMissingReferencedRow(error)) {
        throw new ImpressoraServiceError("Um dos materiais informados não foi encontrado.", 404);
      }
      throw error;
    }

    return this.obterImpressoraOuFalhar(id);
  }

  async atualizar(
    id: number,
    data: UpdateImpressoraServiceDTO,
  ): Promise<Impressora> {
    this.validarCamposComuns(data);
    const resultado = await this.impressoraRepository.update(id, data);
    if (resultado === "not_found") {
      throw new ImpressoraServiceError("Impressora não encontrada.", 404);
    }
    if (resultado === "printer_busy") {
      throw new ImpressoraServiceError(
        "Não é possível alterar estado, protocolo ou conexão enquanto a impressora está reservada ou imprimindo.",
        409,
      );
    }
    if (resultado === "additional_slots") {
      throw new ImpressoraServiceError(
        "Esvazie os slots 2, 3 e 4 antes de remover o CFS.",
        409,
      );
    }
    return this.obterImpressoraOuFalhar(id);
  }

  async carregarFilamento(id: number, numeroSlot: number, idMaterial: number): Promise<Impressora> {
    validarNumeroSlot(numeroSlot);
    validarIdMaterial(idMaterial);
    const impressora = await this.obterImpressoraOuFalhar(id);
    if (!impressora.possuiCfs && numeroSlot !== 1) {
      throw new ImpressoraServiceError(
        "Impressoras sem CFS podem utilizar somente o slot 1.",
        409,
      );
    }
    await this.validarMateriaisExistentes([{ numeroSlot, idMaterial }]);

    let resultado: UpsertSlotResult;
    try {
      resultado = await this.impressoraRepository.upsertSlot(id, numeroSlot, idMaterial);
    } catch (error) {
      if (isMissingReferencedRow(error)) {
        throw new ImpressoraServiceError(`Material ${idMaterial} não encontrado.`, 404);
      }
      throw error;
    }
    if (resultado === "printer_not_found") {
      throw new ImpressoraServiceError("Impressora não encontrada.", 404);
    }
    if (resultado === "slot_not_allowed") {
      throw new ImpressoraServiceError(
        "Impressoras sem CFS podem utilizar somente o slot 1.",
        409,
      );
    }
    if (resultado === "printer_busy") {
      throw new ImpressoraServiceError(
        "Não é possível alterar filamentos enquanto a impressora está reservada ou imprimindo.",
        409,
      );
    }
    await this.replanejadorFila.reescalonarFilaVirtual();
    return this.obterImpressoraOuFalhar(id);
  }

  async descarregarFilamento(id: number, numeroSlot: number): Promise<{ message: string }> {
    validarNumeroSlot(numeroSlot);
    const impressora = await this.obterImpressoraOuFalhar(id);
    if (!impressora.possuiCfs && numeroSlot !== 1) {
      throw new ImpressoraServiceError(
        "Impressoras sem CFS podem utilizar somente o slot 1.",
        409,
      );
    }
    const resultado: DeleteSlotResult = await this.impressoraRepository.deleteSlot(id, numeroSlot);
    if (resultado === "printer_not_found") {
      throw new ImpressoraServiceError("Impressora não encontrada.", 404);
    }
    if (resultado === "slot_not_allowed") {
      throw new ImpressoraServiceError(
        "Impressoras sem CFS podem utilizar somente o slot 1.",
        409,
      );
    }
    if (resultado === "printer_busy") {
      throw new ImpressoraServiceError(
        "Não é possível alterar filamentos enquanto a impressora está reservada ou imprimindo.",
        409,
      );
    }
    if (resultado === "deleted") {
      await this.replanejadorFila.reescalonarFilaVirtual();
    }
    return { message: `Filamento do slot ${numeroSlot} descarregado com sucesso.` };
  }

  async remover(id: number): Promise<{ message: string }> {
    const resultado: DeleteImpressoraResult = await this.impressoraRepository.delete(id);
    if (resultado === "not_found") {
      throw new ImpressoraServiceError("Impressora não encontrada.", 404);
    }
    if (resultado === "printer_busy") {
      throw new ImpressoraServiceError(
        "Não é possível remover uma impressora com alocação ativa ou em uso.",
        409,
      );
    }
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

  async pararImpressao(idImpressora: number): Promise<Impressora> {
    let impressora: Impressora;
    try {
      impressora = await this.orquestrador.pararImpressao(idImpressora);
    } catch (error) {
      if (error instanceof PedidoImpressoraStateError) {
        throw new ImpressoraServiceError(error.message, 409);
      }
      throw error;
    }
    // Pedido acabou de voltar pra fila — tenta encaixar em outra impressora ociosa imediatamente.
    this.orquestrador.tentarAtribuirAutomaticamente().catch((err) =>
      console.error("[ImpressoraService] Falha na atribuição automática pós-parada:", err.message),
    );
    return impressora;
  }

  async confirmarRemocao(idImpressora: number): Promise<Impressora> {
    let impressora: Impressora;
    try {
      impressora = await this.orquestrador.confirmarRemocao(idImpressora);
    } catch (error) {
      if (error instanceof ImpressoraRepositoryStateError) {
        throw new ImpressoraServiceError(error.message, 409);
      }
      throw error;
    }
    // Impressora acabou de ficar ociosa — tenta preencher com o próximo pedido da fila.
    this.orquestrador.tentarAtribuirAutomaticamente().catch((err) =>
      console.error("[ImpressoraService] Falha na atribuição automática pós-remoção:", err.message),
    );
    return impressora;
  }

  async tentarAtribuirAutomaticamente() {
    return this.orquestrador.tentarAtribuirAutomaticamente();
  }

  async listarEventos(idImpressora: number, limit = 20) {
    return this.orquestrador.listarEventos(idImpressora, limit);
  }

  async obterProgresso(id: number): Promise<ProgressoImpressora> {
    const status = await this.orquestrador.sincronizarStatusSilencioso(id);
    if (!status) {
      return { progressoPct: null, tempoRestanteS: null, statusFisico: "desconhecido" };
    }
    return {
      progressoPct: status.progressoPct ?? null,
      tempoRestanteS: status.tempoRestanteS ?? null,
      statusFisico: status.statusFisico,
    };
  }
}
