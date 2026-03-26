import axios from "axios";
import FormData from "form-data";
import { Impressora } from "../impressoras.repository";
import { resolverConexaoDaImpressora } from "./helpers";
import { normalizarStatusMoonraker } from "./normalizacao";
import {
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterJobPayload,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

export class MoonrakerAdapter implements IPrinterCommunicationAdapter {
  readonly protocolo = "MOONRAKER" as const;

  private headers(impressora: Impressora) {
    if (!impressora.api_key) {
      return {};
    }

    return {
      "X-Api-Key": impressora.api_key,
      Authorization: `Bearer ${impressora.api_key}`,
    };
  }

  async healthCheck(impressora: Impressora): Promise<PrinterHealthCheckResult> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const response = await axios.get(
      `${conexao.baseUrl}/printer/objects/query?webhooks&print_stats`,
      {
        headers: this.headers(impressora),
        timeout: conexao.timeoutMs,
      },
    );

    const estado = response.data?.result?.status?.print_stats?.state ?? "desconhecido";
    const webhooksState = response.data?.result?.status?.webhooks?.state ?? "desconhecido";

    return {
      ok: true,
      mensagem: `Moonraker acessível. print_stats=${estado}, webhooks=${webhooksState}.`,
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
    formData.append("root", "gcodes");
    formData.append("print", "true");

    const response = await axios.post(`${conexao.baseUrl}/server/files/upload`, formData, {
      headers: {
        ...this.headers(impressora),
        ...formData.getHeaders(),
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: conexao.timeoutMs,
    });

    const filename =
      response.data?.result?.item?.path ??
      response.data?.result?.item?.filename ??
      payload.nomeArquivo;

    return {
      ok: true,
      mensagem: "Arquivo enviado ao Moonraker e solicitação de impressão enviada.",
      jobRemotoId: filename,
      nomeArquivoRemoto: filename,
      rawStatus: response.data,
    };
  }

  async getStatus(impressora: Impressora): Promise<PrinterRuntimeStatus> {
    const conexao = resolverConexaoDaImpressora(impressora);
    const response = await axios.get(
      `${conexao.baseUrl}/printer/objects/query?webhooks&virtual_sdcard&print_stats`,
      {
        headers: this.headers(impressora),
        timeout: conexao.timeoutMs,
      },
    );

    const status = response.data?.result?.status ?? {};
    const state = status?.print_stats?.state ?? "desconhecido";
    const filename = status?.print_stats?.filename ?? null;
    const webhooksState = status?.webhooks?.state ?? "desconhecido";
    const mensagem = status?.webhooks?.message ?? null;

    return {
      disponivel: webhooksState === "ready",
      statusDominio: normalizarStatusMoonraker(state),
      statusFisico: state,
      jobRemotoId: filename,
      mensagem,
      detalhes: response.data,
    };
  }
}
