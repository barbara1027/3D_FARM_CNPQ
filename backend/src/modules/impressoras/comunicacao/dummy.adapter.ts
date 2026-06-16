import { Impressora } from "../impressoras.repository";
import {
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterJobPayload,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

// Guarda estado por impressora: { jobId, finishAt }
const dummyJobs = new Map<number, { jobId: string; finishAt: number }>();

// Duração simulada de impressão: 10 minutos (tempo suficiente para testar progress bar)
const DUMMY_PRINT_DURATION_MS = 10 * 60 * 1000;

export class DummyPrinterAdapter implements IPrinterCommunicationAdapter {
  readonly protocolo = "DUMMY" as const;

  async healthCheck(_impressora: Impressora): Promise<PrinterHealthCheckResult> {
    return {
      ok: true,
      mensagem: "Modo DUMMY: conexão simulada com sucesso.",
    };
  }

  async uploadAndStart(
    impressora: Impressora,
    payload: PrinterJobPayload,
  ): Promise<PrinterStartJobResult> {
    const jobId = `dummy-${Date.now()}`;
    dummyJobs.set(impressora.id, {
      jobId,
      finishAt: Date.now() + DUMMY_PRINT_DURATION_MS,
    });
    return {
      ok: true,
      mensagem: `Modo DUMMY: envio simulado do arquivo ${payload.nomeArquivo}. Impressão termina em 2 minutos.`,
      jobRemotoId: jobId,
      nomeArquivoRemoto: payload.nomeArquivo,
      rawStatus: { simulado: true },
    };
  }

  async getStatus(impressora: Impressora): Promise<PrinterRuntimeStatus> {
    let job = dummyJobs.get(impressora.id);

    // Reconstruct in-memory state when server restarts mid-print.
    // Always start at ~50% to avoid timezone issues with ultima_sincronizacao.
    if (!job && impressora.status === "Imprimindo") {
      dummyJobs.set(impressora.id, {
        jobId: impressora.jobRemotoId ?? "dummy-recovered",
        finishAt: Date.now() + DUMMY_PRINT_DURATION_MS / 2,
      });
      job = dummyJobs.get(impressora.id);
    }

    if (job && Date.now() < job.finishAt) {
      const restanteSeg = Math.ceil((job.finishAt - Date.now()) / 1000);
      const elapsed = DUMMY_PRINT_DURATION_MS - (job.finishAt - Date.now());
      const progressoPct = Math.min(99, Math.round((elapsed / DUMMY_PRINT_DURATION_MS) * 100));
      return {
        disponivel: true,
        statusDominio: "Imprimindo",
        statusFisico: "dummy-printing",
        jobRemotoId: job.jobId,
        mensagem: `Modo DUMMY: imprimindo... ${restanteSeg}s restantes.`,
        progressoPct,
        tempoRestanteS: restanteSeg,
        detalhes: { simulado: true, restanteSeg },
      };
    }

    // Job terminou ou não há job
    if (job) dummyJobs.delete(impressora.id);
    return {
      disponivel: true,
      statusDominio: "Ociosa",
      statusFisico: "dummy-idle",
      mensagem: "Modo DUMMY: impressão concluída.",
      detalhes: { simulado: true },
    };
  }
}
