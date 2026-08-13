import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extrairExtrusoresLogicosGcode,
  GcodeLogicalFilamentError,
  GcodeLogicalFilamentErrorCode,
  validarExtrusorLogicoMonomaterial,
} from "./gcode-logical-filament.parser";

function esperarErro(
  acao: () => unknown,
  codigo: GcodeLogicalFilamentErrorCode,
): GcodeLogicalFilamentError {
  let erroCapturado: unknown;
  try {
    acao();
  } catch (erro) {
    erroCapturado = erro;
  }
  if (!(erroCapturado instanceof GcodeLogicalFilamentError)) {
    throw new Error(`Era esperado o erro ${codigo}.`);
  }
  assert.equal(erroCapturado.code, codigo);
  return erroCapturado;
}

describe("parser do filamento lógico no G-code", () => {
  it("extrai Tn executável e ignora ocorrências em comentários", () => {
    const gcode = [
      "; T0 é somente documentação",
      "(T1 também é comentário)",
      "G28 (comentário aninhado (T2))",
      "N10 T7 ; T3 ignorado",
      "G1 X20 Y20",
      "t7",
    ].join("\n");

    assert.deepEqual(extrairExtrusoresLogicosGcode(gcode), [7]);
  });

  it("aceita palavras G-code contíguas e não interpreta partes de texto", () => {
    assert.deepEqual(
      extrairExtrusoresLogicosGcode("N10T3G1X2\nM117 TEXT1 pronto\n"),
      [3],
    );
  });

  it("não confunde parâmetros ou texto de outros opcodes com troca de ferramenta", () => {
    assert.deepEqual(
      extrairExtrusoresLogicosGcode([
        "M117 T7 aguardando",
        "M118 T2 telemetria",
        "M104 T1 S200",
        "N1G1X2T3",
      ].join("\n")),
      [],
    );
  });

  it("aceita opcode T após número de linha, com espaço ou checksum", () => {
    assert.deepEqual(
      extrairExtrusoresLogicosGcode("N10 T7\nN20T7*42\n"),
      [7],
    );
  });

  it("retorna o único índice explícito mesmo quando ele não é zero", () => {
    assert.equal(validarExtrusorLogicoMonomaterial("G28\nT12\nG1 X1\n"), 12);
  });

  it("aceita T0 somente quando ele aparece explicitamente", () => {
    assert.equal(validarExtrusorLogicoMonomaterial("T0\nG1 X1"), 0);
  });

  it("falha explicitamente quando não há comando Tn executável", () => {
    const erro = esperarErro(
      () => validarExtrusorLogicoMonomaterial("; T0\nG28\n(T4)\nG1 X1"),
      "GCODE_LOGICAL_FILAMENT_NOT_FOUND",
    );
    assert.match(erro.message, /não é seguro presumir T0/);
  });

  it("falha explicitamente quando há múltiplos índices distintos", () => {
    const erro = esperarErro(
      () => validarExtrusorLogicoMonomaterial("T2\nG1 X1\nT4\nT2"),
      "GCODE_MULTIPLE_LOGICAL_FILAMENTS",
    );
    assert.match(erro.message, /2, 4/);
  });
});
