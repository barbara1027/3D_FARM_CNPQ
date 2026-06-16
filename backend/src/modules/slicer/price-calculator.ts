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
 * Calcula o preço final do pedido.
 *
 * Fórmula:
 *   custoTempo       = (segundos / 3600) × hourlyRate
 *   custoMaterial    = gramas × preçoPorGrama
 *   taxaBase         = valor fixo por pedido (cobre overhead)
 *   taxaComplexidade = subtotal × score × 0.6   (máx: +60% quando score=1.0)
 *   subtotal         = custoTempo + custoMaterial + taxaBase + taxaComplexidade
 *   taxaStripe       = (subtotal + 0.39) / (1 - 0.0399) - subtotal
 *   total            = subtotal + taxaStripe
 */
export function calculatePrice(
  metrics:      GcodeMetrics,
  pricePerGram: number,
  complexity:   number,           // score 0.0-1.0
): PriceBreakdown {
  const hourlyRate = parseFloat(process.env.BASE_HOURLY_RATE   ?? "15.00");
  const taxaBase   = parseFloat(process.env.TAXA_BASE_PEDIDO   ?? "5.00");
  const stripeFee  = parseFloat(process.env.STRIPE_FEE_PCT     ?? "0.0399");
  const stripeFixed= parseFloat(process.env.STRIPE_FEE_FIXED   ?? "0.39");

  const horas           = metrics.timeSeconds / 3600;
  const custoTempo      = horas * hourlyRate;
  const custoMaterial   = metrics.materialGrams * pricePerGram;

  // Taxa de complexidade: até 60% sobre o custo base quando score = 1.0
  // Ex: score 0.5 → +30%, score 0.8 → +48%, score 1.0 → +60%
  const baseParaComplexidade = custoTempo + custoMaterial + taxaBase;
  const taxaComplexidade     = baseParaComplexidade * complexity * 0.60;

  const subtotal   = baseParaComplexidade + taxaComplexidade;

  // Taxa do Stripe embutida no preço (quem paga é o cliente):
  // total = (subtotal + fixo) / (1 - percentual)
  const total      = (subtotal + stripeFixed) / (1 - stripeFee);
  const taxaStripe = total - subtotal;

  const round = (n: number) => Math.round(n * 100) / 100;

  return {
    custoTempo:       round(custoTempo),
    custoMaterial:    round(custoMaterial),
    taxaBase:         round(taxaBase),
    taxaComplexidade: round(taxaComplexidade),
    subtotal:         round(subtotal),
    taxaStripe:       round(taxaStripe),
    total:            round(total),
  };
}
