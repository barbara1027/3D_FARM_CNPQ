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

  /**
   * Algumas impressoras (ex.: firmwares "tudo em um" tipo Creality K1/Qidi)
   * já vêm com macros próprias de START_PRINT/END_PRINT que fazem limpeza de
   * bico, nivelamento de mesa e desligamento seguro — muito mais completas
   * que o G-code genérico que o PrusaSlicer gera sozinho. Quando existem,
   * usamos elas; quando não existem (impressora sem essas macros), cai de
   * volta pro comportamento padrão sem quebrar nada.
   */
  private async temMacro(impressora: Impressora, nomeMacro: string): Promise<boolean> {
    try {
      const conexao = resolverConexaoDaImpressora(impressora);
      const response = await axios.get(`${conexao.baseUrl}/printer/objects/list`, {
        headers: this.headers(impressora),
        timeout: conexao.timeoutMs,
      });
      const objetos: string[] = response.data?.result?.objects ?? [];
      return objetos.includes(`gcode_macro ${nomeMacro}`);
    } catch {
      return false;
    }
  }

  private async rodarGcode(impressora: Impressora, script: string): Promise<void> {
    const conexao = resolverConexaoDaImpressora(impressora);
    await axios.post(
      `${conexao.baseUrl}/printer/gcode/script`,
      { script },
      { headers: this.headers(impressora), timeout: conexao.timeoutMs },
    );
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
    // `ok` precisa refletir se a impressora está de fato pronta para receber
    // uma impressão (Klippy "ready"), não só se a requisição HTTP respondeu —
    // senão o chamador (iniciarReserva) nunca detecta Klippy em erro/desligado
    // antes de tentar o upload real.
    const ok = webhooksState === "ready";

    return {
      ok,
      mensagem: ok
        ? `Moonraker acessível. print_stats=${estado}, webhooks=${webhooksState}.`
        : `Moonraker respondeu, mas o Klippy não está pronto (webhooks=${webhooksState}, print_stats=${estado}).`,
      detalhes: response.data,
    };
  }

  async uploadAndStart(
    impressora: Impressora,
    payload: PrinterJobPayload,
  ): Promise<PrinterStartJobResult> {
    const conexao = resolverConexaoDaImpressora(impressora);

    if (!conexao.baseUrl.includes(":7125")) {
      console.warn(
        `[MoonrakerAdapter] ATENÇÃO: baseUrl "${conexao.baseUrl}" não usa porta 7125. ` +
        `O upload de G-code pode ser bloqueado pelo nginx na porta 80. ` +
        `Configure a impressora com baseUrl = http://<IP>:7125`,
      );
    }
    console.log(`[MoonrakerAdapter] Upload → ${conexao.baseUrl}/server/files/upload (arquivo: ${payload.nomeArquivo}, ${payload.conteudo.length} bytes)`);

    // Verifica estado do Klippy antes de tentar o upload
    try {
      const probe = await axios.get(
        `${conexao.baseUrl}/printer/objects/query?webhooks`,
        { headers: this.headers(impressora), timeout: conexao.timeoutMs },
      );
      const klippyState: string = probe.data?.result?.status?.webhooks?.state ?? "desconhecido";
      if (klippyState !== "ready") {
        throw new Error(
          `Klippy não está pronto para receber impressões (estado atual: "${klippyState}"). ` +
          `Verifique a impressora na interface web do Moonraker e resolva qualquer erro antes de tentar novamente.`,
        );
      }
    } catch (err: any) {
      if (err instanceof Error && err.message.includes("Klippy")) throw err;
      // Sem resposta nenhuma (rede indisponível, timeout, DNS, conexão
      // recusada) é diferente de uma resposta HTTP inesperada de um firmware
      // antigo: só o segundo caso é seguro degradar e seguir para o upload.
      // O primeiro precisa falhar rápido, com diagnóstico claro, em vez de
      // silenciosamente tentar o upload (até 60s) contra uma impressora
      // inalcançável.
      if (axios.isAxiosError(err) && !err.response) {
        throw new Error(
          `Não foi possível contatar a impressora em ${conexao.baseUrl} antes do upload: ` +
          `${err.message}. Verifique a conectividade de rede antes de tentar novamente.`,
        );
      }
      console.warn(`[MoonrakerAdapter] Não foi possível verificar o estado do Klippy: ${err.message}`);
    }

    // Se a impressora tiver macro própria de início (limpeza de bico, nivelamento
    // de mesa, etc.), chama ela com as temperaturas extraídas do cabeçalho do
    // G-code, antes de mandar o arquivo. Melhor esforço — se falhar por qualquer
    // motivo, segue com o fluxo normal (o G-code já tem seu próprio aquecimento).
    if (await this.temMacro(impressora, "START_PRINT")) {
      try {
        const header = payload.conteudo.subarray(0, 4000).toString("utf-8");
        const extruderTemp = header.match(/^; first_layer_temperature = (\d+)/m)?.[1];
        const bedTemp = header.match(/^; first_layer_bed_temperature = (\d+)/m)?.[1];
        if (extruderTemp && bedTemp) {
          console.log(`[MoonrakerAdapter] Chamando START_PRINT (BED_TEMP=${bedTemp} EXTRUDER_TEMP=${extruderTemp})`);
          await this.rodarGcode(impressora, `START_PRINT BED_TEMP=${bedTemp} EXTRUDER_TEMP=${extruderTemp}`);
        } else {
          console.warn("[MoonrakerAdapter] START_PRINT existe mas não achei as temperaturas no cabeçalho do G-code — pulando.");
        }
      } catch (err: any) {
        console.warn(`[MoonrakerAdapter] Falha ao chamar START_PRINT, seguindo sem ela: ${err.message}`);
      }
    }

    const formData = new FormData();
    formData.append("file", payload.conteudo, {
      filename: payload.nomeArquivo,
      contentType: "application/octet-stream",
      knownLength: payload.conteudo.length,
    });
    formData.append("root", "gcodes");

    let uploadResponse: any;
    try {
      uploadResponse = await axios.post(`${conexao.baseUrl}/server/files/upload`, formData, {
        headers: {
          ...this.headers(impressora),
          ...formData.getHeaders(),
          Expect: "",  // desabilita 100-continue, evita rejeição pelo tornado
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: Math.max(conexao.timeoutMs, 60_000),  // upload pode demorar mais
      });
    } catch (err: any) {
      const status = err.response?.status ?? "sem resposta";
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Moonraker: falha no upload do G-code (HTTP ${status}): ${detail}`);
    }

    const filename =
      uploadResponse.data?.result?.item?.path ??
      uploadResponse.data?.result?.item?.filename ??
      payload.nomeArquivo;

    console.log(`[MoonrakerAdapter] Upload concluído. Iniciando impressão: ${filename}`);

    // Moonraker não suporta print=true no upload — é necessário chamar o endpoint separadamente
    try {
      await axios.post(
        `${conexao.baseUrl}/printer/print/start`,
        { filename },
        { headers: this.headers(impressora), timeout: conexao.timeoutMs },
      );
    } catch (err: any) {
      const status = err.response?.status ?? "sem resposta";
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Moonraker: falha ao iniciar impressão do arquivo "${filename}" (HTTP ${status}): ${detail}`);
    }

    return {
      ok: true,
      mensagem: "Arquivo enviado ao Moonraker e impressão iniciada.",
      jobRemotoId: filename,
      nomeArquivoRemoto: filename,
      rawStatus: uploadResponse.data,
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

    // virtual_sdcard.progress is 0.0–1.0
    const rawProgress = status?.virtual_sdcard?.progress;
    const progressoPct = rawProgress != null ? Math.round(rawProgress * 100) : null;

    // print_stats.print_duration and total_duration can estimate remaining time
    const printDuration: number | null = status?.print_stats?.print_duration ?? null;
    let tempoRestanteS: number | null = null;
    if (progressoPct != null && progressoPct > 0 && printDuration != null) {
      const estimatedTotal = printDuration / (progressoPct / 100);
      tempoRestanteS = Math.max(0, Math.round(estimatedTotal - printDuration));
    }

    return {
      disponivel: webhooksState === "ready",
      statusDominio: normalizarStatusMoonraker(state),
      statusFisico: state,
      jobRemotoId: filename,
      mensagem,
      progressoPct: progressoPct != null && progressoPct >= 0 ? progressoPct : null,
      tempoRestanteS,
      detalhes: response.data,
    };
  }

  async desligarAquecedores(impressora: Impressora): Promise<void> {
    if (await this.temMacro(impressora, "END_PRINT")) {
      try {
        await this.rodarGcode(impressora, "END_PRINT");
        return;
      } catch (err: any) {
        console.warn(`[MoonrakerAdapter] Falha ao chamar END_PRINT, usando desligamento genérico: ${err.message}`);
      }
    }
    await this.rodarGcode(impressora, "M104 S0\nM140 S0");
  }

  async cancelarImpressao(impressora: Impressora): Promise<void> {
    const conexao = resolverConexaoDaImpressora(impressora);
    await axios.post(
      `${conexao.baseUrl}/printer/print/cancel`,
      {},
      { headers: this.headers(impressora), timeout: conexao.timeoutMs },
    );
  }
}
