import fs from "fs";
import readline from "readline";

export interface GcodeMetrics {
  // Dados básicos
  timeSeconds:    number;
  materialGrams:  number;

  // Fatores de complexidade brutos
  supportRatio:       number;  // 0-1  proporção de extrusão de suporte vs total
  externalPerimRatio: number;  // 0-1  proporção de perímetro externo vs total
  retractionCount:    number;  // número de retrações
  shortSegmentCount:  number;  // movimentos de extrusão < 1mm
  islandCount:        number;  // transições para ;TYPE:External perimeter (ilhas distintas)
  layerChanges:       number;  // total de mudanças de camada
}

/**
 * Densidades típicas por tipo de material (g/cm³).
 * Usadas para converter volume [cm³] do G-code em gramas quando
 * PrusaSlicer não recebeu --filament-density.
 */
const DENSITY_BY_TYPE: Record<string, number> = {
  PLA:    1.24,
  PETG:   1.27,
  ABS:    1.04,
  ASA:    1.07,
  TPU:    1.21,
  NYLON:  1.13,
  PA:     1.13,
  PC:     1.20,
  RESINA: 1.12,
  RESIN:  1.12,
};

export function densityForMaterial(tipo: string): number {
  const key = tipo.toUpperCase().split(/[\s_-]/)[0];
  return DENSITY_BY_TYPE[key] ?? 1.24;
}

/**
 * Lê o G-code gerado pelo PrusaSlicer 2.x via streaming e extrai métricas.
 *
 * Estratégia para métricas baseadas em volume (supportRatio, externalPerimRatio):
 *   Rastreia seções ;TYPE: e acumula avanço de E por tipo de movimento.
 *   Ratio = E no tipo / E total.
 *
 * Estratégia para retrações:
 *   PrusaSlicer marca retrações com "; retract" inline — mais confiável que
 *   detectar E negativo em modo absoluto (M82).
 *
 * Estratégia para islandCount:
 *   Conta transições para ;TYPE:External perimeter, mas só como ilha nova
 *   quando precedidas de um deslocamento sem extrusão maior que
 *   ISLAND_TRAVEL_THRESHOLD_MM desde a última extrusão real. Sem esse filtro,
 *   o marcador ;TYPE:External perimeter se repete várias vezes por camada
 *   (alternância entre parede interna/externa do mesmo contorno) e infla o
 *   contador sem relação com fragmentação geométrica real.
 */
const ISLAND_TRAVEL_THRESHOLD_MM = 2;
export async function parseGcode(
  gcodePath: string,
  filamentDensity = 1.24,
): Promise<GcodeMetrics> {
  let timeSeconds = 0;
  let timeFound   = false;
  let volumeCm3   = 0;

  let currentType  = "";
  let isAbsoluteE  = true;
  let curE         = 0;
  let totalE       = 0;   // E acumulado total (apenas extrusão real)
  let supportE     = 0;   // E em seções de suporte
  let externalE    = 0;   // E em seções de perímetro externo

  let retractionCount   = 0;
  let shortSegmentCount = 0;
  let islandCount       = 0;
  let layerChanges      = 0;

  let curX = 0, curY = 0, curZ = 0;
  let hasExtruded       = false;
  let travelSinceExtrude = 0;   // mm percorridos sem extrusão desde a última extrusão real

  await new Promise<void>((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(gcodePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      const t = line.trim();

      // ── Estatísticas do cabeçalho ─────────────────────────────
      if (!timeFound) {
        const m = t.match(
          /^; estimated printing time.*?=\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+)s/,
        );
        if (m) {
          timeSeconds =
            (parseInt(m[1] ?? "0") * 3600) +
            (parseInt(m[2] ?? "0") * 60)   +
             parseInt(m[3] ?? "0");
          timeFound = true;
        }
      }

      // Volume de filamento: PrusaSlicer sempre gera isso independente da densidade
      const cm3m = t.match(/^; filament used \[cm3\]\s*=\s*([\d.]+)/i);
      if (cm3m) { volumeCm3 = parseFloat(cm3m[1]); return; }

      // ── Modo de extrusão ──────────────────────────────────────
      if (t === "M82") { isAbsoluteE = true;  return; }
      if (t === "M83") { isAbsoluteE = false; return; }

      // Reset de E (G92 E0 ou G92 Exx)
      const g92 = t.match(/^G92\s[^;]*?E([\d.]+)/);
      if (g92) { curE = parseFloat(g92[1]); return; }

      // ── Marcadores de seção ───────────────────────────────────
      if (t.startsWith(";TYPE:")) {
        currentType = t.slice(6);
        if (currentType === "External perimeter") {
          if (!hasExtruded || travelSinceExtrude > ISLAND_TRAVEL_THRESHOLD_MM) {
            islandCount++;
          }
        }
        return;
      }

      // ── Mudanças de camada ────────────────────────────────────
      if (t.startsWith(";LAYER_CHANGE") || /^;Z:\d/.test(t)) {
        layerChanges++;
        return;
      }

      // ── Retrações: detecta pelo comentário "; retract" ────────
      // PrusaSlicer em modo E absoluto (M82) usa este comentário em retrações.
      if (t.includes("; retract") && !t.includes("; unretract")) {
        retractionCount++;
      }

      // ── Movimentos G0/G1 ──────────────────────────────────────
      const mv = t.match(
        /^(G0|G1)(?:\s[^;]*?X([-\d.]+))?(?:\s[^;]*?Y([-\d.]+))?(?:\s[^;]*?Z([-\d.]+))?(?:\s[^;]*?E([-\d.]+))?/,
      );
      if (!mv) return;

      const nx = mv[2] != null ? parseFloat(mv[2]) : curX;
      const ny = mv[3] != null ? parseFloat(mv[3]) : curY;
      const nz = mv[4] != null ? parseFloat(mv[4]) : curZ;

      const isRetractLine = t.includes("; retract") || t.includes("; unretract");
      const dist = Math.sqrt((nx - curX) ** 2 + (ny - curY) ** 2 + (nz - curZ) ** 2);

      let isRealExtrusion = false;

      if (mv[5] != null) {
        const newE = parseFloat(mv[5]);
        const dE   = isAbsoluteE ? newE - curE : newE;
        curE       = isAbsoluteE ? newE : curE + newE;

        // Conta apenas extrusão real (dE positivo, sem linhas de retract/unretract)
        if (!isRetractLine && dE > 0.001) {
          isRealExtrusion = true;
          totalE += dE;
          if (currentType === "Support" || currentType === "Support interface") {
            supportE += dE;
          }
          if (currentType === "External perimeter") {
            externalE += dE;
          }
        }
      }

      // Rastreia deslocamento sem extrusão, usado para detectar ilhas (ver islandCount acima)
      if (isRealExtrusion) {
        hasExtruded = true;
        travelSinceExtrude = 0;
      } else {
        travelSinceExtrude += dist;
      }

      // Segmentos curtos: apenas G1 com extrusão real e distância < 1mm
      if (mv[1] === "G1" && isRealExtrusion && dist > 0 && dist < 1.0) {
        shortSegmentCount++;
      }

      curX = nx; curY = ny; curZ = nz;
    });

    rl.on("close", resolve);
    rl.on("error", reject);
  });

  if (!timeFound) throw new Error("Tempo estimado não encontrado no G-code.");

  return {
    timeSeconds,
    materialGrams:      Math.round(volumeCm3 * filamentDensity * 100) / 100,
    supportRatio:       totalE > 0 ? supportE       / totalE : 0,
    externalPerimRatio: totalE > 0 ? externalE      / totalE : 0,
    retractionCount,
    shortSegmentCount,
    islandCount,
    layerChanges,
  };
}
