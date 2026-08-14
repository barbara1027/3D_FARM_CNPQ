import { db } from "../../database/connection";
import { DadosBaseTemporal, pedidoEstaProntoParaFila } from "./baseTemporal.service";

export type StatusPedido =
  | "analisando"           // slicer rodando em background
  | "aguardando_pagamento" // orçamento pronto, aguarda pagamento
  | "aguardando_revisao"   // peça complexa, admin precisa aprovar
  | "na_fila"              // pago e aprovado, aguarda impressão
  | "em_impressao"
  | "concluido"
  | "falhou"
  | "cancelado";

export interface Pedido {
  id: number;
  nome: string;
  preco: number;
  descricao: string | null;
  status: StatusPedido;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  parametros: Record<string, any> | null;
  quantidade: number;
  gcodePath: string | null;
  tempoEstimadoS: number | null;
  materialGramas: number | null;
  scoreComplexidade: number | null;
  motivoComplexidade: string | null;
  precoBase: number | null;
  taxaComplexidade: number | null;
  taxaStripe: number | null;
  createdAt: string;
  updatedAt: string;
  // campos de fila e ETA
  tempoGcodeHoras: number | null;
  prazoEntregaHoras: number | null;
  prazoEntrega: string | null;
  etaHorasEstimado: number | null;
  etaCalculadoEm: string | null;
  prazoEntregaOriginal: string | null;
  limiteInicioImpressao: string | null;
  prioridadePaga: boolean;
  tempoMaximoEsperaHoras: number | null;
  bufferPrioridadeHoras: number | null;
  bufferSegurancaHoras: number | null;
  tempoExecFarmHoras: number | null;
  // dimensões físicas da peça (bounding box do G-code, ver Fase 7)
  dimensaoXMm: number | null;
  dimensaoYMm: number | null;
  dimensaoZMm: number | null;
  // campos JOIN
  nomeUsuario?: string;
  emailUsuario?: string;
  nomeMaterial?: string;
  nomeArquivo?: string;
  caminhoArquivo?: string;
  idArquivoGcode?: number | null;
}

/**
 * Pedido validado e pronto para a heurística de fila / cálculo de workload.
 * Diferente do `Pedido` geral (onde os campos temporais podem ser `null`
 * enquanto o pedido ainda está em `analisando`), todo campo aqui é
 * obrigatório: `findPendentesParaOtimizacao` só devolve pedidos que já
 * passaram por `pedidoEstaProntoParaFila`.
 */
export interface PedidoOtimizacaoRow {
  id: number;
  idMaterial: number;
  tempoGcodeHoras: number;
  prazoEntrega: string;
  prazoEntregaOriginal: string;
  prazoEntregaHoras: number;
  limiteInicioImpressao: string;
  etaHorasEstimado: number;
  etaCalculadoEm: string;
  tempoExecFarmHoras: number;
  tempoMaximoEsperaHoras: number;
  bufferPrioridadeHoras: number;
  bufferSegurancaHoras: number;
  criadoEm: Date;
  prioridadePaga: boolean;
  // Dimensões físicas da peça (Fase 7/20) — opcionais: pedidos antigos ou
  // sem G-code analisado não bloqueiam a fila por falta desse dado; nesse
  // caso a checagem de compatibilidade com a mesa simplesmente não filtra.
  dimensaoXMm: number | null;
  dimensaoYMm: number | null;
  dimensaoZMm: number | null;
}

export interface CreatePedidoRepositoryDTO {
  nome: string;
  preco?: number;
  descricao?: string | null;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  status: StatusPedido;
  parametros?: Record<string, any> | null;
  quantidade?: number;
  tempoGcodeHoras?: number | null;
  prazoEntregaHoras?: number | null;
  prazoEntrega?: string | Date | null;
  etaHorasEstimado?: number | null;
  etaCalculadoEm?: string | Date | null;
  prazoEntregaOriginal?: string | Date | null;
  limiteInicioImpressao?: string | Date | null;
  prioridadePaga?: boolean;
  tempoMaximoEsperaHoras?: number | null;
  bufferPrioridadeHoras?: number | null;
  bufferSegurancaHoras?: number | null;
  tempoExecFarmHoras?: number | null;
}

export interface UpdatePedidoRepositoryDTO {
  preco?: number;
  descricao?: string | null;
  status?: StatusPedido;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  parametros?: Record<string, any> | null;
  tempoGcodeHoras?: number;
  prazoEntregaHoras?: number;
  prazoEntrega?: string | Date | null;
  etaHorasEstimado?: number | null;
  etaCalculadoEm?: string | Date | null;
  prazoEntregaOriginal?: string | Date | null;
  limiteInicioImpressao?: string | Date | null;
  prioridadePaga?: boolean;
  tempoMaximoEsperaHoras?: number | null;
  bufferPrioridadeHoras?: number | null;
  bufferSegurancaHoras?: number | null;
  tempoExecFarmHoras?: number | null;
}

export type UpdatePedidoResult =
  | "updated"
  | "not_found"
  | "execution_active"
  | "status_forbidden";
export type DeletePedidoResult =
  | "deleted"
  | "not_found"
  | "status_blocked"
  | "execution_active";

function toNumber(value: unknown): number {
  return Number(value);
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

/** `NULL`/`undefined` viram `null`, nunca `0` — ao contrário de `Number(null) === 0`. */
export function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

/** Candidato à otimização ainda não validado: qualquer campo temporal pode estar ausente. */
type CandidatoOtimizacao = DadosBaseTemporal & {
  id: number;
  idMaterial: number;
  criadoEm: Date;
  prioridadePaga: boolean;
  dimensaoXMm: number | null;
  dimensaoYMm: number | null;
  dimensaoZMm: number | null;
};

function mapCandidatoOtimizacao(row: any): CandidatoOtimizacao {
  return {
    id: toNumber(row.id),
    idMaterial: toNumber(row.idMaterial),
    tempoGcodeHoras: toNullableNumber(row.tempoGcodeHoras),
    tempoExecFarmHoras: toNullableNumber(row.tempoExecFarmHoras),
    etaHorasEstimado: toNullableNumber(row.etaHorasEstimado),
    etaCalculadoEm: row.etaCalculadoEm ?? null,
    prazoEntregaHoras: toNullableNumber(row.prazoEntregaHoras),
    prazoEntrega: row.prazoEntrega ?? null,
    prazoEntregaOriginal: row.prazoEntregaOriginal ?? null,
    limiteInicioImpressao: row.limiteInicioImpressao ?? null,
    tempoMaximoEsperaHoras: toNullableNumber(row.tempoMaximoEsperaHoras),
    bufferPrioridadeHoras: toNullableNumber(row.bufferPrioridadeHoras),
    bufferSegurancaHoras: toNullableNumber(row.bufferSegurancaHoras),
    criadoEm: row.criadoEm,
    prioridadePaga: toBoolean(row.prioridadePaga),
    dimensaoXMm: toNullableNumber(row.dimensaoXMm),
    dimensaoYMm: toNullableNumber(row.dimensaoYMm),
    dimensaoZMm: toNullableNumber(row.dimensaoZMm),
  };
}

const SEL = `
  SELECT
    p.id, p.nome, p.preco, p.descricao, p.status,
    p.id_usuario        AS idUsuario,
    p.id_material       AS idMaterial,
    p.id_qualidade      AS idQualidade,
    p.id_arquivo        AS idArquivo,
    p.parametros,
    p.quantidade,
    p.gcode_path        AS gcodePath,
    p.tempo_estimado_s  AS tempoEstimadoS,
    p.material_gramas   AS materialGramas,
    p.score_complexidade  AS scoreComplexidade,
    p.motivo_complexidade AS motivoComplexidade,
    p.preco_base        AS precoBase,
    p.taxa_complexidade AS taxaComplexidade,
    p.taxa_stripe       AS taxaStripe,
    p.tempo_gcode_horas AS tempoGcodeHoras,
    p.prazo_entrega_horas AS prazoEntregaHoras,
    DATE_FORMAT(p.prazo_entrega, '%Y-%m-%d %H:%i:%s') AS prazoEntrega,
    p.eta_horas_estimado AS etaHorasEstimado,
    DATE_FORMAT(p.eta_calculado_em, '%Y-%m-%d %H:%i:%s') AS etaCalculadoEm,
    DATE_FORMAT(p.prazo_entrega_original, '%Y-%m-%d %H:%i:%s') AS prazoEntregaOriginal,
    DATE_FORMAT(p.limite_inicio_impressao, '%Y-%m-%d %H:%i:%s') AS limiteInicioImpressao,
    p.prioridade_paga AS prioridadePaga,
    p.tempo_maximo_espera_horas AS tempoMaximoEsperaHoras,
    p.buffer_prioridade_horas AS bufferPrioridadeHoras,
    p.buffer_seguranca_horas AS bufferSegurancaHoras,
    p.tempo_exec_farm_horas AS tempoExecFarmHoras,
    p.dimensao_x_mm AS dimensaoXMm,
    p.dimensao_y_mm AS dimensaoYMm,
    p.dimensao_z_mm AS dimensaoZMm,
    DATE_FORMAT(p.created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
    DATE_FORMAT(p.updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt,
    u.nome   AS nomeUsuario,
    u.email  AS emailUsuario,
    m.nome        AS nomeMaterial,
    a.nome        AS nomeArquivo,
    a.caminho     AS caminhoArquivo,
    ag.id         AS idArquivoGcode
  FROM pedidos p
  LEFT JOIN usuarios  u  ON u.id  = p.id_usuario
  LEFT JOIN materiais m  ON m.id  = p.id_material
  LEFT JOIN arquivos  a  ON a.id  = p.id_arquivo
  LEFT JOIN arquivos  ag ON ag.id_pedido = p.id AND ag.tipo = 'gcode'
`;

export class PedidoRepository {
  async findAll(): Promise<Pedido[]> {
    const [rows] = await db.execute(`${SEL} ORDER BY p.id DESC`);
    return (rows as any[]).map(r => ({ ...r }));
  }

  async findByUsuario(idUsuario: number): Promise<Pedido[]> {
    const [rows] = await db.execute(
      `${SEL} WHERE p.id_usuario = ? ORDER BY p.id DESC`, [idUsuario]
    );
    return (rows as any[]).map(r => ({ ...r }));
  }

  async findById(id: number): Promise<Pedido | null> {
    const [rows] = await db.execute(`${SEL} WHERE p.id = ? LIMIT 1`, [id]);
    return ((rows as any[])[0] ?? null);
  }

  /**
   * Pedidos elegíveis para a heurística de fila. Devolve datas absolutas
   * (não horas corridas já subtraídas em SQL) — a conversão para horas
   * operacionais restantes é responsabilidade de quem consome esta lista
   * (`FilaService`, via `calcularHorasOperacionaisEntre`), pois só assim a
   * fila usa a mesma definição de jornada que o `EtaEntregaService`.
   *
   * Nenhum pedido sem base temporal válida é devolvido: a heurística não
   * pode inventar um prazo/ETA para um registro incompleto. Um pedido em
   * `na_fila` sem base temporal é um estado inconsistente (não deveria
   * acontecer, dado que todos os caminhos para `na_fila` validam antes) —
   * quando ocorre, é ignorado aqui e registrado no log em vez de afetar o
   * escalonamento.
   */
  async findPendentesParaOtimizacao(): Promise<PedidoOtimizacaoRow[]> {
    const [rows] = await db.execute(`
      SELECT
        p.id,
        p.id_material AS idMaterial,
        p.tempo_gcode_horas AS tempoGcodeHoras,
        p.tempo_exec_farm_horas AS tempoExecFarmHoras,
        p.dimensao_x_mm AS dimensaoXMm,
        p.dimensao_y_mm AS dimensaoYMm,
        p.dimensao_z_mm AS dimensaoZMm,
        p.eta_horas_estimado AS etaHorasEstimado,
        DATE_FORMAT(p.eta_calculado_em, '%Y-%m-%d %H:%i:%s') AS etaCalculadoEm,
        p.prazo_entrega_horas AS prazoEntregaHoras,
        DATE_FORMAT(p.prazo_entrega, '%Y-%m-%d %H:%i:%s') AS prazoEntrega,
        DATE_FORMAT(p.prazo_entrega_original, '%Y-%m-%d %H:%i:%s') AS prazoEntregaOriginal,
        DATE_FORMAT(p.limite_inicio_impressao, '%Y-%m-%d %H:%i:%s') AS limiteInicioImpressao,
        p.tempo_maximo_espera_horas AS tempoMaximoEsperaHoras,
        p.buffer_prioridade_horas AS bufferPrioridadeHoras,
        p.buffer_seguranca_horas AS bufferSegurancaHoras,
        p.created_at AS criadoEm,
        p.prioridade_paga AS prioridadePaga
      FROM pedidos p
      WHERE p.status = 'na_fila'
        AND NOT EXISTS (
          SELECT 1
          FROM pedido_impressora pi
          WHERE pi.id_pedido = p.id
            AND pi.status IN ('reservado', 'em_impressao')
        )
      ORDER BY p.created_at ASC, p.id ASC
    `);

    const validos: PedidoOtimizacaoRow[] = [];
    for (const candidato of (rows as any[]).map(mapCandidatoOtimizacao)) {
      if (!pedidoEstaProntoParaFila(candidato)) {
        console.error(
          `[PedidoRepository] Pedido ${candidato.id} está em 'na_fila' sem base temporal ` +
            "válida; ignorado no planejamento da fila.",
        );
        continue;
      }
      validos.push(candidato as PedidoOtimizacaoRow);
    }
    return validos;
  }

  async create(data: CreatePedidoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO pedidos (
        nome, preco, descricao, id_usuario, id_material, id_qualidade,
        id_arquivo, status, parametros, quantidade,
        tempo_gcode_horas, prazo_entrega_horas, prazo_entrega,
        eta_horas_estimado, eta_calculado_em, prazo_entrega_original,
        limite_inicio_impressao, prioridade_paga,
        tempo_maximo_espera_horas, buffer_prioridade_horas,
        buffer_seguranca_horas, tempo_exec_farm_horas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, FALSE), ?, ?, ?, ?)
    `, [
      data.nome,
      data.preco ?? 0,
      data.descricao ?? null,
      data.idUsuario,
      data.idMaterial,
      data.idQualidade,
      data.idArquivo,
      data.status,
      data.parametros ? JSON.stringify(data.parametros) : null,
      data.quantidade ?? 1,
      data.tempoGcodeHoras ?? null,
      data.prazoEntregaHoras ?? null,
      data.prazoEntrega ?? null,
      data.etaHorasEstimado ?? null,
      data.etaCalculadoEm ?? null,
      data.prazoEntregaOriginal ?? null,
      data.limiteInicioImpressao ?? null,
      data.prioridadePaga ?? null,
      data.tempoMaximoEsperaHoras ?? null,
      data.bufferPrioridadeHoras ?? null,
      data.bufferSegurancaHoras ?? null,
      data.tempoExecFarmHoras ?? null,
    ]);
    return result.insertId;
  }

  async update(id: number, data: UpdatePedidoRepositoryDTO): Promise<UpdatePedidoResult> {
    if (data.status !== undefined) return "status_forbidden";
    const campos: string[] = [];
    const vals: any[]      = [];

    if (data.preco       !== undefined) { campos.push("preco = ?");        vals.push(data.preco); }
    if (data.descricao   !== undefined) { campos.push("descricao = ?");    vals.push(data.descricao); }
    if (data.idMaterial  !== undefined) { campos.push("id_material = ?");  vals.push(data.idMaterial); }
    if (data.idQualidade !== undefined) { campos.push("id_qualidade = ?"); vals.push(data.idQualidade); }
    if (data.idArquivo   !== undefined) { campos.push("id_arquivo = ?");   vals.push(data.idArquivo); }
    if (data.parametros  !== undefined) {
      campos.push("parametros = ?");
      vals.push(data.parametros ? JSON.stringify(data.parametros) : null);
    }

    if (data.tempoGcodeHoras !== undefined) { campos.push("tempo_gcode_horas = ?"); vals.push(data.tempoGcodeHoras); }
    if (data.prazoEntregaHoras !== undefined) { campos.push("prazo_entrega_horas = ?"); vals.push(data.prazoEntregaHoras); }
    if (data.prazoEntrega !== undefined) { campos.push("prazo_entrega = ?"); vals.push(data.prazoEntrega); }
    if (data.etaHorasEstimado !== undefined) { campos.push("eta_horas_estimado = ?"); vals.push(data.etaHorasEstimado); }
    if (data.etaCalculadoEm !== undefined) { campos.push("eta_calculado_em = ?"); vals.push(data.etaCalculadoEm); }
    if (data.prazoEntregaOriginal !== undefined) { campos.push("prazo_entrega_original = ?"); vals.push(data.prazoEntregaOriginal); }
    if (data.limiteInicioImpressao !== undefined) { campos.push("limite_inicio_impressao = ?"); vals.push(data.limiteInicioImpressao); }
    if (data.prioridadePaga !== undefined) { campos.push("prioridade_paga = ?"); vals.push(data.prioridadePaga); }
    if (data.tempoMaximoEsperaHoras !== undefined) { campos.push("tempo_maximo_espera_horas = ?"); vals.push(data.tempoMaximoEsperaHoras); }
    if (data.bufferPrioridadeHoras !== undefined) { campos.push("buffer_prioridade_horas = ?"); vals.push(data.bufferPrioridadeHoras); }
    if (data.bufferSegurancaHoras !== undefined) { campos.push("buffer_seguranca_horas = ?"); vals.push(data.bufferSegurancaHoras); }
    if (data.tempoExecFarmHoras !== undefined) { campos.push("tempo_exec_farm_horas = ?"); vals.push(data.tempoExecFarmHoras); }

    if (campos.length === 0) return "updated";

    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [pedidoRows] = await connection.execute(
        "SELECT id FROM pedidos WHERE id = ? FOR UPDATE",
        [id],
      );
      if ((pedidoRows as any[]).length === 0) {
        await connection.rollback();
        transactionStarted = false;
        return "not_found";
      }

      const alteraEntradaFisica =
        data.idMaterial !== undefined ||
        data.idQualidade !== undefined ||
        data.idArquivo !== undefined;
      if (alteraEntradaFisica) {
        const [activeRows] = await connection.execute(
          `SELECT id
           FROM pedido_impressora
           WHERE id_pedido = ? AND status IN ('reservado', 'em_impressao')
           LIMIT 1
           FOR UPDATE`,
          [id],
        );
        if ((activeRows as any[]).length > 0) {
          await connection.rollback();
          transactionStarted = false;
          return "execution_active";
        }
      }

      vals.push(id);
      const [result]: any = await connection.execute(
        `UPDATE pedidos SET ${campos.join(", ")} WHERE id = ?`,
        vals,
      );
      if (Number(result.affectedRows) !== 1) {
        throw new Error("O pedido mudou durante a atualização.");
      }
      await connection.commit();
      transactionStarted = false;
      return "updated";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(id: number): Promise<DeletePedidoResult> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [pedidoRows] = await connection.execute(
        "SELECT status FROM pedidos WHERE id = ? FOR UPDATE",
        [id],
      );
      const pedido = (pedidoRows as any[])[0];
      if (!pedido) {
        await connection.rollback();
        transactionStarted = false;
        return "not_found";
      }
      if (["na_fila", "em_impressao", "concluido"].includes(String(pedido.status))) {
        await connection.rollback();
        transactionStarted = false;
        return "status_blocked";
      }

      const [allocationRows] = await connection.execute(
        `SELECT id
         FROM pedido_impressora
         WHERE id_pedido = ?
           AND status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
         LIMIT 1
         FOR UPDATE`,
        [id],
      );
      const [printerRows] = await connection.execute(
        `SELECT id
         FROM impressoras
         WHERE id_pedido_atual = ?
         LIMIT 1
         FOR UPDATE`,
        [id],
      );
      if ((allocationRows as any[]).length > 0 || (printerRows as any[]).length > 0) {
        await connection.rollback();
        transactionStarted = false;
        return "execution_active";
      }

      const [result]: any = await connection.execute(
        "DELETE FROM pedidos WHERE id = ?",
        [id],
      );
      if (Number(result.affectedRows) !== 1) {
        throw new Error("O pedido mudou durante a remoção.");
      }
      await connection.commit();
      transactionStarted = false;
      return "deleted";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}
