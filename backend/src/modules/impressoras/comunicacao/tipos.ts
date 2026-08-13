import { ApiProtocol, Impressora, PrinterStatus } from "../impressoras.repository";

export type ProtocoloImpressora = ApiProtocol;

export interface PrinterConnectionInfo {
  baseUrl: string;
  timeoutMs: number;
  headers: Record<string, string>;
}

export interface PrinterHealthCheckResult {
  ok: boolean;
  mensagem: string;
  detalhes?: unknown;
}

export interface PrinterStartJobResult {
  ok: boolean;
  mensagem: string;
  jobRemotoId?: string | null;
  nomeArquivoRemoto?: string | null;
  rawStatus?: unknown;
}

export interface PrinterRuntimeStatus {
  disponivel: boolean;
  statusDominio: PrinterStatus;
  statusFisico: string;
  jobRemotoId?: string | null;
  mensagem?: string | null;
  progressoPct?: number | null;   // 0–100, null if not available
  tempoRestanteS?: number | null; // seconds remaining, null if unknown
  detalhes?: unknown;
}

export interface PrinterJobPayload {
  nomeArquivo: string;
  conteudo: Buffer;
}

/**
 * Material escolhido pelo planejamento da 3D Farm. `idMaterialBanco` pertence
 * exclusivamente ao banco da aplicação e não identifica um material no CFS.
 */
export interface MaterialPlanejado {
  idMaterialBanco: number;
  numeroSlot: number;
}

/** Endereço físico relatado pelo inventário atual do dispositivo. */
export interface EnderecoFisicoCfs {
  boxId: number | string;
  deviceMaterialId: number | string;
  numeroSlot: number;
}

export interface CfsInventoryItem extends EnderecoFisicoCfs {
  tipoMaterial?: string;
  cor?: string;
}

export interface CfsInventory {
  itens: CfsInventoryItem[];
  consultadoEm?: string;
}

/**
 * Mapeamento explícito entre o filamento lógico do arquivo e o endereço
 * físico do CFS. O adapter nunca escolhe nem presume o extrusor lógico.
 */
export interface CfsFilamentMapping {
  extrusorLogico: number;
  materialPlanejado: MaterialPlanejado;
  enderecoFisico: EnderecoFisicoCfs;
  tipoMaterial?: string;
  cor?: string;
}

export interface CfsPrintSubmission {
  caminhoGcode: string;
  nomeArquivo: string;
  /** Literal `true`: este contrato existe somente para o fluxo CFS. */
  openCfs: true;
  filamentos: CfsFilamentMapping[];
}

export interface CfsPrintStartResult {
  ok: boolean;
  aceito: boolean;
  confirmadoFisicamente: boolean;
  mensagem: string;
  jobRemotoId?: string | null;
  nomeArquivoRemoto?: string | null;
  mapeamentoAplicado: CfsFilamentMapping[];
  rawStatus?: unknown;
}

export type CfsPrintErrorCode =
  | "CFS_MAPPING_UNSUPPORTED"
  | "CFS_NOT_CONFIGURED"
  | "CFS_INVENTORY_UNAVAILABLE"
  | "CFS_SLOT_NOT_FOUND"
  | "CFS_MAPPING_INVALID";

export const CFS_MAPPING_UNSUPPORTED: CfsPrintErrorCode = "CFS_MAPPING_UNSUPPORTED";

export class CfsPrintAdapterError extends Error {
  constructor(
    readonly code: CfsPrintErrorCode,
    mensagem: string,
  ) {
    super(`${code}: ${mensagem}`);
    this.name = "CfsPrintAdapterError";
  }
}

export interface CfsPrintSubmissionAdapter {
  readonly tipo: "CREALITY_CFS" | "DUMMY_CFS";
  /** Configuração em memória disponível somente em adapters simulados. */
  configurarInventarioCfs?(idImpressora: number, inventario: CfsInventory): void;
  consultarInventarioCfs(impressora: Impressora): Promise<CfsInventory>;
  enviarEIniciarComMapeamento(
    impressora: Impressora,
    entrada: CfsPrintSubmission,
  ): Promise<CfsPrintStartResult>;
}

export interface IPrinterCommunicationAdapter {
  readonly protocolo: ProtocoloImpressora;
  healthCheck(impressora: Impressora): Promise<PrinterHealthCheckResult>;
  uploadAndStart(impressora: Impressora, payload: PrinterJobPayload): Promise<PrinterStartJobResult>;
  /**
   * Gancho sem I/O externo usado somente para sincronizar o controle DUMMY
   * quando o job foi iniciado pelo adapter DUMMY CFS.
   */
  registrarInicioExternoSimulado?(impressora: Impressora, jobRemotoId: string): void;
  getStatus(impressora: Impressora): Promise<PrinterRuntimeStatus>;
  /**
   * Desliga bico e mesa. Chamado sempre que um job é encerrado pelo nosso
   * sistema (concluído automaticamente, liberado manualmente pelo admin, etc).
   * Necessário porque o desligamento "natural" vem do G-code de finalização
   * do PrusaSlicer — se a impressão for interrompida/marcada como concluída
   * antes de chegar no fim do arquivo, esse G-code nunca roda e o bico fica
   * quente e parado, escorrendo/entupindo até o próximo job.
   */
  desligarAquecedores(impressora: Impressora): Promise<void>;
}
