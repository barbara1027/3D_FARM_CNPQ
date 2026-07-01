import type { GcodeMetrics } from "./gcode-parser";

export interface PriceBreakdown {
  custoTempo:       number;  // R$ por hora × horas
  custoMaterial:    number;  // gramas × preço/grama
  taxaBase:         number;  // taxa fixa por pedido
  taxaComplexidade: number;  // sobretaxa proporcional ao score (0 se não complexo)
  subtotal:         number;  // soma antes do Stripe
  taxaStripe:       number;  // taxa do Stripe embutida
  total:            number;  // preço final cobrado do cliente
}

/**
 * Calcula o preço para 1 unidade (sem Stripe — aplicar separadamente).
 *
 * Fórmula:
 *   custoTempo       = (segundos / 3600) × hourlyRate
 *   custoMaterial    = gramas × preçoPorGrama
 *   taxaBase         = valor fixo por pedido (cobre overhead)
 *   taxaComplexidade = subtotal × score × 0.6   — SOMENTE se isComplex=true
 *                      (máx: +60% quando score=1.0)
 *   subtotal         = custoTempo + custoMaterial + taxaBase + taxaComplexidade
 */
export function calculatePrice(
  metrics:      GcodeMetrics,
  pricePerGram: number,
  complexity:   number,    // score 0.0-1.0
  isComplex:    boolean,   // aplica taxa de complexidade apenas se true
): PriceBreakdown {
  const hourlyRate = parseFloat(process.env.BASE_HOURLY_RATE ?? "15.00");
  const taxaBase   = parseFloat(process.env.TAXA_BASE_PEDIDO ?? "5.00");

  const horas         = metrics.timeSeconds / 3600;
  const custoTempo    = horas * hourlyRate;
  const custoMaterial = metrics.materialGrams * pricePerGram;

  const baseParaComplexidade = custoTempo + custoMaterial ;
  const taxaComplexidade     = isComplex
    ? baseParaComplexidade * complexity * 0.60
    : 0;

  const subtotal = baseParaComplexidade + taxaComplexidade + taxaBase;

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    custoTempo:       round(custoTempo),
    custoMaterial:    round(custoMaterial),
    taxaBase:         round(taxaBase),
    taxaComplexidade: round(taxaComplexidade),
    subtotal:         round(subtotal),
    taxaStripe:       0,   // calculado em applyStripeFee sobre o total do pedido
    total:            round(subtotal),
  };
}

/**
 * Aplica a taxa do Stripe sobre o subtotal total do pedido (uma única transação).
 *
 *   total      = (subtotal + fixo) / (1 - percentual)
 *   taxaStripe = total - subtotal
 */
export function applyStripeFee(subtotal: number): { total: number; taxaStripe: number } {
  const stripeFee   = parseFloat(process.env.STRIPE_FEE_PCT   ?? "0.0399");
  const stripeFixed = parseFloat(process.env.STRIPE_FEE_FIXED ?? "0.39");
  const total       = (subtotal + stripeFixed) / (1 - stripeFee);
  const taxaStripe  = total - subtotal;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { total: round(total), taxaStripe: round(taxaStripe) };
}
