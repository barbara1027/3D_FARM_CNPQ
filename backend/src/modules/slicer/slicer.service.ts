import path from "path";
import fs   from "fs/promises";
import { spawn } from "child_process";

export interface SliceParams {
  layerHeight?:       string;
  infill?:            string;
  wallThickness?:     string;
  printSpeed?:        string;
  supports?:          string;
  adhesion?:          string;
  // Temperaturas
  tempBico?:          string;
  tempMesa?:          string;
  // Parâmetros estruturais
  perimeters?:        string;
  topLayers?:         string;
  bottomLayers?:      string;
  supportAngle?:      string;
  // Fan / refrigeração
  fanMin?:            string;
  fanMax?:            string;
  // Filamento
  filamentDiameter?:  string;
}

const DEFAULTS: Required<SliceParams> = {
  layerHeight:      "0.2",
  infill:           "15",
  wallThickness:    "0.8",
  printSpeed:       "50",
  supports:         "none",
  adhesion:         "none",
  tempBico:         "",
  tempMesa:         "",
  perimeters:       "2",
  topLayers:        "3",
  bottomLayers:     "3",
  supportAngle:     "45",
  fanMin:           "",
  fanMax:           "",
  filamentDiameter: "",
};

export function gcodeOutputPath(pedidoId: number): string {
  const dir = path.resolve(process.env.GCODE_DIR ?? "gcode_storage");
  return path.join(dir, `pedido_${pedidoId}.gcode`);
}

const CENTRO_PADRAO_MM = { x: 110, y: 110 };

export interface BedCenter {
  x: number;
  y: number;
  // Dimensões reais da mesa, em mm. Quando ausentes, a mesa é assumida
  // quadrada com base no dobro do centro (compatibilidade com o padrão
  // antigo, que só informava o centro).
  larguraMesaMm?: number;
  profundidadeMesaMm?: number;
}

export async function runPrusaSlicer(
  stlPath:    string,
  outputPath: string,
  params:     SliceParams = {},
  // Centro da mesa usado pelo slicer. Não assume mais uma mesa fixa
  // 220×220: quem chama informa o centro real (ou o maior conhecido entre
  // as impressoras cadastradas — ver auto-slice.service.ts), garantindo que
  // o G-code não fique deslocado para máquinas com mesa maior/menor.
  bedCenter:  BedCenter = CENTRO_PADRAO_MM,
): Promise<void> {
  const prusaExe = process.env.PRUSA_SLICER_PATH ??
    "/Applications/PrusaSlicer.app/Contents/MacOS/PrusaSlicer";

  await fs.mkdir(path.dirname(outputPath), { recursive: true });

  const p = { ...DEFAULTS, ...params };
  const centro = {
    x: Number.isFinite(bedCenter?.x) && bedCenter.x > 0 ? bedCenter.x : CENTRO_PADRAO_MM.x,
    y: Number.isFinite(bedCenter?.y) && bedCenter.y > 0 ? bedCenter.y : CENTRO_PADRAO_MM.y,
  };
  // Sem --bed-shape, o PrusaSlicer usa a mesa padrão embutida no CLI (não a
  // mesa real da impressora), e pode recusar peças válidas como "fora da
  // área de impressão" mesmo com --center correto. Quando as dimensões reais
  // não são informadas, assume mesa quadrada do dobro do centro (mesma
  // suposição que o --center já fazia implicitamente).
  const larguraMesa =
    Number.isFinite(bedCenter?.larguraMesaMm) && bedCenter!.larguraMesaMm! > 0
      ? bedCenter!.larguraMesaMm!
      : centro.x * 2;
  const profundidadeMesa =
    Number.isFinite(bedCenter?.profundidadeMesaMm) && bedCenter!.profundidadeMesaMm! > 0
      ? bedCenter!.profundidadeMesaMm!
      : centro.y * 2;
  const bedShape = `0x0,${larguraMesa}x0,${larguraMesa}x${profundidadeMesa},0x${profundidadeMesa}`;

  const args: string[] = [
    "--slice",
    "--gcode-comments",
    "--bed-shape",            bedShape,
    "--center",              `${centro.x},${centro.y}`,
    "--scale",               "1",
    "--layer-height",        p.layerHeight,
    "--fill-density",        `${p.infill}%`,
    "--perimeter-speed",     p.printSpeed,
    "--infill-speed",        p.printSpeed,
    "--perimeters",          p.perimeters,
    "--top-solid-layers",    p.topLayers,
    "--bottom-solid-layers", p.bottomLayers,
    "--output",              outputPath,
  ];

  // Espessura de parede: número de perímetros × largura de extrusão
  // PrusaSlicer usa --perimeters para isso; wallThickness é informativo

  // Suporte
  if (p.supports !== "none") {
    args.push("--support-material");
    if (p.supports === "touching_buildplate") {
      args.push("--support-material-buildplate-only");
    }
    if (p.supportAngle) {
      args.push("--support-material-threshold", p.supportAngle);
    }
  } else {
    args.push("--no-support-material");
  }

  // Adesão
  if (p.adhesion === "brim")      args.push("--brim-width", "5");
  else if (p.adhesion === "raft") args.push("--raft-layers", "3");

  // Temperaturas
  if (p.tempBico) {
    args.push("--temperature", p.tempBico);
    args.push("--first-layer-temperature", p.tempBico);
  }
  if (p.tempMesa) {
    args.push("--bed-temperature", p.tempMesa);
    args.push("--first-layer-bed-temperature", p.tempMesa);
  }

  // Refrigeração (fan)
  if (p.fanMin) args.push("--min-fan-speed", p.fanMin);
  if (p.fanMax) args.push("--max-fan-speed", p.fanMax);
  if (p.fanMin && Number(p.fanMin) > 0) args.push("--fan-always-on");

  // Diâmetro do filamento
  if (p.filamentDiameter) args.push("--filament-diameter", p.filamentDiameter);

  args.push(stlPath);

  console.log(`[SLICER] ${prusaExe} ${args.slice(0, 8).join(" ")} ...`);

  return new Promise((resolve, reject) => {
    const proc = spawn(prusaExe, args);
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => { stdout += d.toString(); });
    proc.stderr.on("data", (d) => { stderr += d.toString(); });
    proc.on("error", (err) =>
      reject(new Error(`PrusaSlicer não encontrado: ${err.message}\nVerifique PRUSA_SLICER_PATH no .env`))
    );
    proc.on("close", async (code) => {
      if (code !== 0) {
        reject(new Error(`PrusaSlicer saiu com código ${code}: ${stderr.slice(0, 400)}`));
        return;
      }
      // PrusaSlicer pode sair com código 0 sem gerar o arquivo (ex.: peça fora
      // do volume de impressão, mesa/objeto incompatíveis) — a mensagem real
      // some no stdout, não afeta o exit code.
      const outputExists = await fs.stat(outputPath).then(() => true).catch(() => false);
      if (!outputExists) {
        const detail = (stdout + stderr).trim().slice(0, 400);
        reject(new Error(
          `PrusaSlicer terminou sem erro mas não gerou o G-code.` +
          (detail ? ` Saída: ${detail}` : ""),
        ));
        return;
      }
      resolve();
    });
  });
}
