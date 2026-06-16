import axios from "axios";
import FormData from "form-data";
import { Impressora } from "../impressoras.repository";
import { resolverConexaoDaImpressora } from "./helpers";
import { normalizarStatusOctoprint } from "./normalizacao";
import {
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterJobPayload,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

export class OctoprintAdapter implements IPrinterCommunicationAdapter {
  readonly protocolo = "OCTOPRINT" as const;

  async healthCheck(impressora: Impressora): Promise<PrinterHealthCheckResult> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const response = await axios.get(`${conexao.baseUrl}/api/printer`, {
      headers: {
        ...(impressora.api_key ? { "X-Api-Key": impressora.api_key } : {}),
      },
      timeout: conexao.timeoutMs,
    });

    const statusText = response.data?.state?.text ?? "sem status";

    return {
      ok: true,
      mensagem: `OctoPrint acessível. Estado atual: ${statusText}.`,
      detalhes: response.data,
    };
  }

  async uploadAndStart(
    impressora: Impressora,
    payload: PrinterJobPayload,
  ): Promise<PrinterStartJobResult> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const formData = new FormData();
    formData.append("file", payload.conteudo, payload.nomeArquivo);
    formData.append("select", "true");
    formData.append("print", "true");

    const response = await axios.post(`${conexao.baseUrl}/api/files/local`, formData, {
      headers: {
        ...(impressora.api_key ? { "X-Api-Key": impressora.api_key } : {}),
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: conexao.timeoutMs,
    });

    // Upload 201 = sucesso. effectivePrint indica se a impressão foi disparada
    // automaticamente, mas é informativo — não invalida o envio.
    const effectivePrint = Boolean(response.data?.effectivePrint);
    const remoteName = response.data?.files?.local?.name ?? payload.nomeArquivo;

    return {
      ok: true,
      mensagem: effectivePrint
        ? "Arquivo enviado e impressão iniciada no OctoPrint."
        : "Arquivo enviado ao OctoPrint (impressão iniciada via print=true).",
      jobRemotoId: remoteName,
      nomeArquivoRemoto: remoteName,
      rawStatus: response.data,
    };
  }

  async getStatus(impressora: Impressora): Promise<PrinterRuntimeStatus> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const headers = impressora.api_key ? { "X-Api-Key": impressora.api_key } : {};

    const response = await axios.get(`${conexao.baseUrl}/api/printer`, {
      headers,
      timeout: conexao.timeoutMs,
    });

    const text = response.data?.state?.text ?? "unknown";
    const flags = response.data?.state?.flags ?? {};

    // Fetch job progress separately — best-effort
    let progressoPct: number | null = null;
    let tempoRestanteS: number | null = null;
    try {
      const jobResp = await axios.get(`${conexao.baseUrl}/api/job`, {
        headers,
        timeout: conexao.timeoutMs,
      });
      const completion = jobResp.data?.progress?.completion;
      if (completion != null) progressoPct = Math.round(completion);
      const printTimeLeft = jobResp.data?.progress?.printTimeLeft;
      if (printTimeLeft != null) tempoRestanteS = Math.round(printTimeLeft);
    } catch { /* progress not critical */ }

    return {
      disponivel: Boolean(flags.operational || flags.ready || flags.printing || flags.paused),
      statusDominio: normalizarStatusOctoprint({ text, flags }),
      statusFisico: text,
      jobRemotoId: response.data?.job?.file?.path ?? null,
      progressoPct,
      tempoRestanteS,
      detalhes: response.data,
    };
  }
}
