import { Impressora } from "../impressoras.repository";
import {
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterJobPayload,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

export class DummyPrinterAdapter implements IPrinterCommunicationAdapter {
  readonly protocolo = "DUMMY" as const;

  async healthCheck(_impressora: Impressora): Promise<PrinterHealthCheckResult> {
    return {
      ok: true,
      mensagem: "Modo DUMMY: conexão simulada com sucesso.",
    };
  }

  async uploadAndStart(
    _impressora: Impressora,
    payload: PrinterJobPayload,
  ): Promise<PrinterStartJobResult> {
    return {
      ok: true,
      mensagem: `Modo DUMMY: envio simulado do arquivo ${payload.nomeArquivo}.`,
      jobRemotoId: `dummy-${Date.now()}`,
      nomeArquivoRemoto: payload.nomeArquivo,
      rawStatus: { simulado: true },
    };
  }

  async getStatus(_impressora: Impressora): Promise<PrinterRuntimeStatus> {
    return {
      disponivel: true,
      statusDominio: "Ociosa",
      statusFisico: "dummy-idle",
      mensagem: "Modo DUMMY: status simulado.",
      detalhes: { simulado: true },
    };
  }
}
