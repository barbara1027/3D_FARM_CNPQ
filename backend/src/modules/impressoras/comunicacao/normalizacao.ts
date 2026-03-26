import { PrinterStatus } from "../impressoras.repository";

export function normalizarStatusMoonraker(state: string): PrinterStatus {
  const normalized = state.trim().toLowerCase();

  switch (normalized) {
    case "standby":
    case "complete":
    case "ready":
      return "Ociosa";
    case "printing":
      return "Imprimindo";
    case "paused":
      return "Pausada";
    case "error":
    case "cancelled":
      return "Erro";
    default:
      return "Indisponivel";
  }
}

export function normalizarStatusOctoprint(payload: {
  text?: string;
  flags?: {
    operational?: boolean;
    paused?: boolean;
    printing?: boolean;
    error?: boolean;
    ready?: boolean;
    closedOrError?: boolean;
  };
}): PrinterStatus {
  if (payload.flags?.closedOrError || payload.flags?.error) {
    return "Erro";
  }

  if (payload.flags?.paused) {
    return "Pausada";
  }

  if (payload.flags?.printing) {
    return "Imprimindo";
  }

  if (payload.flags?.operational || payload.flags?.ready) {
    return "Ociosa";
  }

  const text = payload.text?.trim().toLowerCase() ?? "";
  if (text.includes("paused")) return "Pausada";
  if (text.includes("print")) return "Imprimindo";
  if (text.includes("error")) return "Erro";
  if (text.includes("operational") || text.includes("ready")) return "Ociosa";

  return "Indisponivel";
}
