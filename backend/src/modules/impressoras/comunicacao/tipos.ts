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
}
