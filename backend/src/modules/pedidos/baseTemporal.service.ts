/**
 * Validação central da base temporal de um pedido.
 *
 * Nenhum pedido pode entrar (ou permanecer) em `status = 'na_fila'` sem possuir
 * todos os campos abaixo devidamente calculados pelo `EtaEntregaService`. Esta
 * regra é usada por todos os caminhos que podem levar um pedido a `na_fila`:
 * o pipeline automático de slicing, o webhook do Stripe, a reimpressão manual
 * e a consulta da heurística de fila.
 */

export interface DadosBaseTemporal {
  tempoGcodeHoras: number | null;
  tempoExecFarmHoras: number | null;
  etaHorasEstimado: number | null;
  etaCalculadoEm: string | Date | null;
  prazoEntregaHoras: number | null;
  prazoEntrega: string | Date | null;
  prazoEntregaOriginal: string | Date | null;
  limiteInicioImpressao: string | Date | null;
  tempoMaximoEsperaHoras: number | null;
  bufferPrioridadeHoras: number | null;
  bufferSegurancaHoras: number | null;
}

function numeroPositivo(value: number | null): boolean {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function numeroNaoNegativo(value: number | null): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function presente(value: unknown): boolean {
  return value !== null && value !== undefined;
}

/**
 * Verifica se o pedido possui base temporal completa e válida para entrar na
 * fila de impressão. Não preenche nem inventa valores — apenas responde
 * verdadeiro ou falso a partir do que já foi persistido.
 */
export function pedidoEstaProntoParaFila(pedido: DadosBaseTemporal): boolean {
  return (
    numeroPositivo(pedido.tempoGcodeHoras) &&
    numeroPositivo(pedido.tempoExecFarmHoras) &&
    numeroPositivo(pedido.etaHorasEstimado) &&
    presente(pedido.etaCalculadoEm) &&
    presente(pedido.prazoEntrega) &&
    presente(pedido.prazoEntregaOriginal) &&
    presente(pedido.limiteInicioImpressao) &&
    numeroNaoNegativo(pedido.prazoEntregaHoras) &&
    numeroNaoNegativo(pedido.tempoMaximoEsperaHoras) &&
    numeroNaoNegativo(pedido.bufferPrioridadeHoras) &&
    numeroNaoNegativo(pedido.bufferSegurancaHoras)
  );
}

/** Mesma checagem de {@link pedidoEstaProntoParaFila}, lançando quando inválida. */
export function validarBaseTemporalParaFila(pedido: DadosBaseTemporal): void {
  if (!pedidoEstaProntoParaFila(pedido)) {
    throw new Error(
      "Pedido não possui base temporal válida (ETA/prazo/buffers) para entrar na fila de impressão.",
    );
  }
}

/**
 * `prazo_entrega_original` representa o compromisso assumido no primeiro
 * cálculo do ETA e nunca deve ser sobrescrito automaticamente depois disso.
 * Preserva o valor já persistido quando ele existir; só usa o recém-calculado
 * na ausência de um valor anterior (primeiro cálculo).
 */
export function preservarPrazoEntregaOriginal<T>(
  existente: T | null | undefined,
  calculadoAgora: T,
): T {
  return existente ?? calculadoAgora;
}
