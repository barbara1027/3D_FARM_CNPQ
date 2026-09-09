export type GcodeLogicalFilamentErrorCode =
  | "GCODE_LOGICAL_FILAMENT_NOT_FOUND"
  | "GCODE_MULTIPLE_LOGICAL_FILAMENTS"
  | "GCODE_LOGICAL_FILAMENT_INVALID";

export class GcodeLogicalFilamentError extends Error {
  constructor(
    readonly code: GcodeLogicalFilamentErrorCode,
    mensagem: string,
  ) {
    super(`${code}: ${mensagem}`);
    this.name = "GcodeLogicalFilamentError";
  }
}

/**
 * Extrai índices Tn distintos na ordem da primeira ocorrência.
 * Comentários de linha (`;`) e comentários entre parênteses são ignorados.
 */
export function extrairExtrusoresLogicosGcode(conteudoGcode: string): number[] {
  const codigoExecutavel = removerComentariosGcode(conteudoGcode);
  const extrusores = new Set<number>();
  const comandoFerramenta =
    /^(?:N\d+\s*)?T(\d+)(?=$|\s|\*|[A-Z](?=[+-]?(?:\d|\.\d)))/i;

  for (const linha of codigoExecutavel.split(/\r\n|\n|\r/)) {
    const correspondencia = linha.trim().match(comandoFerramenta);
    if (!correspondencia) continue;

    const textoCompleto = correspondencia[0];
    const extrusorLogico = Number(correspondencia[1]);
    if (!Number.isSafeInteger(extrusorLogico)) {
      throw new GcodeLogicalFilamentError(
        "GCODE_LOGICAL_FILAMENT_INVALID",
        `O comando ${textoCompleto} contém um índice fora do intervalo de inteiro seguro.`,
      );
    }
    extrusores.add(extrusorLogico);
  }

  return [...extrusores];
}

/**
 * Contrato temporariamente estrito para o fluxo atual, que aceita somente um
 * filamento lógico distinto. O índice deve existir no arquivo; nunca há T0
 * implícito.
 */
export function validarExtrusorLogicoMonomaterial(conteudoGcode: string): number {
  const extrusores = extrairExtrusoresLogicosGcode(conteudoGcode);
  if (extrusores.length === 0) {
    throw new GcodeLogicalFilamentError(
      "GCODE_LOGICAL_FILAMENT_NOT_FOUND",
      "O G-code não contém nenhum comando Tn executável; não é seguro presumir T0.",
    );
  }
  if (extrusores.length > 1) {
    throw new GcodeLogicalFilamentError(
      "GCODE_MULTIPLE_LOGICAL_FILAMENTS",
      `O fluxo monomaterial exige exatamente um índice lógico, mas encontrou: ${extrusores.join(
        ", ",
      )}.`,
    );
  }
  return extrusores[0];
}

function removerComentariosGcode(conteudoGcode: string): string {
  let codigoExecutavel = "";
  let comentarioLinha = false;
  let profundidadeComentarioBloco = 0;

  for (const caractere of conteudoGcode) {
    if (comentarioLinha) {
      if (caractere === "\n" || caractere === "\r") {
        comentarioLinha = false;
        codigoExecutavel += caractere;
      }
      continue;
    }

    if (profundidadeComentarioBloco > 0) {
      if (caractere === "(") {
        profundidadeComentarioBloco += 1;
      } else if (caractere === ")") {
        profundidadeComentarioBloco -= 1;
      } else if (caractere === "\n" || caractere === "\r") {
        codigoExecutavel += caractere;
      }
      continue;
    }

    if (caractere === ";") {
      comentarioLinha = true;
    } else if (caractere === "(") {
      profundidadeComentarioBloco = 1;
    } else {
      codigoExecutavel += caractere;
    }
  }

  return codigoExecutavel;
}
