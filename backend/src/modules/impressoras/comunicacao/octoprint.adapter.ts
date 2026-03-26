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

    const effectivePrint = Boolean(response.data?.effectivePrint);
    const remoteName = response.data?.files?.local?.name ?? payload.nomeArquivo;

    return {
      ok: effectivePrint,
      mensagem: effectivePrint
        ? "Arquivo enviado e impressão iniciada no OctoPrint."
        : "Arquivo enviado ao OctoPrint, mas a impressão não foi iniciada automaticamente.",
      jobRemotoId: remoteName,
      nomeArquivoRemoto: remoteName,
      rawStatus: response.data,
    };
  }

  async getStatus(impressora: Impressora): Promise<PrinterRuntimeStatus> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const response = await axios.get(`${conexao.baseUrl}/api/printer`, {
      headers: {
        ...(impressora.api_key ? { "X-Api-Key": impressora.api_key } : {}),
      },
      timeout: conexao.timeoutMs,
    });

    const text = response.data?.state?.text ?? "unknown";
    const flags = response.data?.state?.flags ?? {};

    return {
      disponivel: Boolean(flags.operational || flags.ready || flags.printing || flags.paused),
      statusDominio: normalizarStatusOctoprint({ text, flags }),
      statusFisico: text,
      jobRemotoId: response.data?.job?.file?.path ?? null,
      detalhes: response.data,
    };
  }
}
