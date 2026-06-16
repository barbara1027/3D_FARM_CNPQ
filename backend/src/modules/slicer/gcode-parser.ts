import fs from "fs";
import readline from "readline";

export interface GcodeMetrics {
  // Dados básicos
  timeSeconds:    number;
  materialGrams:  number;

  // Fatores de complexidade brutos
  supportRatio:       number;  // 0-1  proporção de material de suporte
  externalPerimRatio: number;  // 0-1  proporção de perímetro externo
  retractionCount:    number;  // número absoluto de retrações
  shortSegmentCount:  number;  // movimentos < 1mm (fragmentação)
  islandCount:        number;  // ilhas de perímetro (geometria fragmentada)
  layerChanges:       number;  // total de mudanças de camada
}

/**
 * Lê o G-code gerado pelo PrusaSlicer via streaming linha a linha e extrai
 * métricas para cálculo do score de complexidade e precificação.
 * Evita carregar o arquivo inteiro em memória (arquivos podem ter centenas de MB).
 */
export async function parseGcode(gcodePath: string): Promise<GcodeMetrics> {
  let timeSeconds = 0;
  let timeFound   = false;
  let materialGrams      = 0;
  let supportRatio       = 0;
  let externalPerimRatio = 0;
  let retractionCount   = 0;
  let shortSegmentCount = 0;
  let islandCount       = 0;
  let layerChanges      = 0;
  let inPerimeter       = false;
  let curX = 0, curY = 0, curZ = 0;

  await new Promise<void>((resolve, reject) => {
    const rl = readline.createInterface({
      input: fs.createReadStream(gcodePath, { encoding: "utf-8" }),
      crlfDelay: Infinity,
    });

    rl.on("line", (line) => {
      const trimmed = line.trim();

      // Tempo estimado: "; estimated printing time (normal mode) = 1h 23m 45s"
      if (!timeFound) {
        const timeMatch = trimmed.match(
          /^; estimated printing time.*?=\s*(?:(\d+)h\s*)?(?:(\d+)m\s*)?(\d+)s/
        );
        if (timeMatch) {
          timeSeconds =
            (parseInt(timeMatch[1] ?? "0", 10) * 3600) +
            (parseInt(timeMatch[2] ?? "0", 10) * 60)   +
             parseInt(timeMatch[3] ?? "0", 10);
          timeFound = true;
        }
      }

      // Gramas de filamento
      const gramMatch = trimmed.match(/^; total filament used \[g\]\s*=\s*([\d.]+)/i);
      if (gramMatch) materialGrams = parseFloat(gramMatch[1]);

      // Suporte e perímetro externo (% do volume total)
      const supportMatch = trimmed.match(/^; support material\s*=\s*([\d.]+)%/i);
      if (supportMatch) supportRatio = parseFloat(supportMatch[1]) / 100;

      const perimMatch = trimmed.match(/^; external perimeters\s*=\s*([\d.]+)%/i);
      if (perimMatch) externalPerimRatio = parseFloat(perimMatch[1]) / 100;

      // Mudanças de camada
      if (trimmed.startsWith(";LAYER_CHANGE") || /^;Z:\d/.test(trimmed)) {
        layerChanges++;
      }

      // Retrações: G1 com E negativo > 0.1mm
      const retract = trimmed.match(/^G1\s.*?E(-[\d.]+)/);
      if (retract && parseFloat(retract[1]) < -0.1) {
        retractionCount++;
        inPerimeter = false;
      }

      // Ilhas de perímetro
      if (trimmed.includes("; perimeter") || trimmed.includes("; external perimeter")) {
        if (!inPerimeter) { islandCount++; inPerimeter = true; }
      }

      // Segmentos curtos (extrusão de distância < 1mm)
      const move = trimmed.match(
        /^(G0|G1)(?:\s.*?X([-\d.]+))?(?:\s.*?Y([-\d.]+))?(?:\s.*?Z([-\d.]+))?/
      );
      if (move) {
        const nx = move[2] ? parseFloat(move[2]) : curX;
        const ny = move[3] ? parseFloat(move[3]) : curY;
        const nz = move[4] ? parseFloat(move[4]) : curZ;
        const d  = Math.sqrt((nx - curX) ** 2 + (ny - curY) ** 2 + (nz - curZ) ** 2);
        if (d > 0 && d < 1.0) shortSegmentCount++;
        if (move[1] === "G0") inPerimeter = false;
        curX = nx; curY = ny; curZ = nz;
      }
    });

    rl.on("close", resolve);
    rl.on("error", reject);
  });

  if (!timeFound) throw new Error("Tempo estimado não encontrado no G-code.");

  return {
    timeSeconds,
    materialGrams,
    supportRatio,
    externalPerimRatio,
    retractionCount,
    shortSegmentCount,
    islandCount,
    layerChanges,
  };
}
