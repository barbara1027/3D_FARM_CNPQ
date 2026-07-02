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

export interface IPrinterCommunicationAdapter {
  readonly protocolo: ProtocoloImpressora;
  healthCheck(impressora: Impressora): Promise<PrinterHealthCheckResult>;
  uploadAndStart(impressora: Impressora, payload: PrinterJobPayload): Promise<PrinterStartJobResult>;
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
