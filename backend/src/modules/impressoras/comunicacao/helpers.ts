import { Impressora } from "../impressoras.repository";
import { PrinterConnectionInfo } from "./tipos";

export function resolverConexaoDaImpressora(impressora: Impressora): PrinterConnectionInfo {
  const baseUrl =
    impressora.baseUrl?.trim() ||
    (impressora.ip ? `http://${impressora.ip.trim()}` : "");

  if (!baseUrl) {
    throw new Error("Impressora sem baseUrl ou ip configurado.");
  }

  const timeoutMs = impressora.timeoutMs && impressora.timeoutMs > 0 ? impressora.timeoutMs : 15000;
  const headers: Record<string, string> = {};

  if (impressora.api_key) {
    headers["X-Api-Key"] = impressora.api_key;
    headers.Authorization = `Bearer ${impressora.api_key}`;
  }

  return {
    baseUrl: baseUrl.replace(/\/$/, ""),
    timeoutMs,
    headers,
  };
}
