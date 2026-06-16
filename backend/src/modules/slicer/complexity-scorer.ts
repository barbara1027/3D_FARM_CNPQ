import type { GcodeMetrics } from "./gcode-parser";

export interface ComplexityResult {
  /** Score final de complexidade: 0.0 (trivial) até 1.0 (extremamente complexo) */
  score:     number;
  /** Peça é considerada complexa se score >= 0.5 */
  isComplex: boolean;
  /** Fatores que contribuíram para o score, com peso e valor */
  factors:   ComplexityFactor[];
  /** Texto legível para exibir ao admin */
  summary:   string;
}

export interface ComplexityFactor {
  name:        string;
  value:       number;   // valor bruto medido
  unit:        string;
  contribution: number;  // quanto este fator adicionou ao score (0-1)
  reason:      string;   // descrição legível
}

/**
 * Calcula o score de complexidade (0.0 – 1.0) a partir das métricas do G-code.
 *
 * Cada fator tem um peso máximo de contribuição. A soma de todos os pesos
 * possíveis = 1.0. O score final é a soma das contribuições reais.
 *
 * Fatores e pesos máximos:
 *   suporte excessivo     → 0.25 (maior risco de falha + pós-processamento manual)
 *   ilhas de perímetro    → 0.20 (geometria fragmentada, difícil de imprimir)
 *   retrações frequentes  → 0.15 (entupimento, stringing)
 *   segmentos curtos      → 0.15 (desgaste e tempo real maior que estimado)
 *   impressão longa       → 0.15 (risco de falha por tempo)
 *   perímetro ext. alto   → 0.10 (proxy de volume de detalhes finos)
 *   ─────────────────────────────
 *   TOTAL máximo          → 1.00
 */
export function scoreComplexity(m: GcodeMetrics): ComplexityResult {
  const factors: ComplexityFactor[] = [];
  let score = 0;

  if (m.supportRatio > 0) {
    // Linear: 0% suporte → 0, 30%+ suporte → 0.25
    const contrib = Math.min(m.supportRatio / 0.30, 1.0) * 0.25;
    score += contrib;
    if (contrib > 0.01) {
      factors.push({
        name: "Suporte",
        value: parseFloat((m.supportRatio * 100).toFixed(1)),
        unit: "%",
        contribution: contrib,
        reason: `${(m.supportRatio * 100).toFixed(1)}% do volume precisa de suporte`,
      });
    }
  }

  // Referência: 20 ilhas = mínimo, 200 ilhas = máximo
  if (m.islandCount > 20) {
    const contrib = Math.min((m.islandCount - 20) / 180, 1.0) * 0.20;
    score += contrib;
    factors.push({
      name: "Ilhas geométricas",
      value: m.islandCount,
      unit: "ilhas",
      contribution: contrib,
      reason: `${m.islandCount} ilhas de perímetro indicam geometria muito fragmentada`,
    });
  }

  // Referência: 200 = normal, 1000 = crítico
  if (m.retractionCount > 200) {
    const contrib = Math.min((m.retractionCount - 200) / 800, 1.0) * 0.15;
    score += contrib;
    factors.push({
      name: "Retrações",
      value: m.retractionCount,
      unit: "retrações",
      contribution: contrib,
      reason: `${m.retractionCount} retrações aumentam risco de entupimento e stringing`,
    });
  }

  // Referência: 500 = normal, 3000 = crítico
  if (m.shortSegmentCount > 500) {
    const contrib = Math.min((m.shortSegmentCount - 500) / 2500, 1.0) * 0.15;
    score += contrib;
    factors.push({
      name: "Segmentos curtos",
      value: m.shortSegmentCount,
      unit: "segmentos",
      contribution: contrib,
      reason: `${m.shortSegmentCount} segmentos <1mm causam desgaste e tempo real maior`,
    });
  }

  // Referência: 2h = normal, 18h = crítico
  if (m.timeSeconds > 2 * 3600) {
    const contrib = Math.min((m.timeSeconds - 2 * 3600) / (16 * 3600), 1.0) * 0.15;
    score += contrib;
    const horas = (m.timeSeconds / 3600).toFixed(1);
    factors.push({
      name: "Duração",
      value: parseFloat(horas),
      unit: "horas",
      contribution: contrib,
      reason: `${horas}h de impressão aumentam risco de falha por tempo`,
    });
  }

  // Referência: 25% = normal, 60% = crítico
  if (m.externalPerimRatio > 0.25) {
    const contrib = Math.min((m.externalPerimRatio - 0.25) / 0.35, 1.0) * 0.10;
    score += contrib;
    factors.push({
      name: "Perímetro externo",
      value: parseFloat((m.externalPerimRatio * 100).toFixed(1)),
      unit: "%",
      contribution: contrib,
      reason: `${(m.externalPerimRatio * 100).toFixed(1)}% de perímetro externo indica detalhes finos`,
    });
  }

  const finalScore = Math.min(Math.round(score * 1000) / 1000, 1.0);
  const isComplex  = finalScore >= 0.5;

  const summary = factors.length > 0
    ? factors.map(f => f.reason).join("; ")
    : "Peça simples sem fatores de risco significativos";

  return { score: finalScore, isComplex, factors, summary };
}
