import { db } from "../../database/connection";

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
  // campos JOIN
  nomeUsuario?: string;
  emailUsuario?: string;
  nomeMaterial?: string;
  nomeArquivo?: string;
  caminhoArquivo?: string;
  idArquivoGcode?: number | null;
}

export interface PedidoOtimizacaoRow {
  id: number;
  idMaterial: number;
  tempoGcodeHoras: number;
  prazoEntregaHoras: number;
  tempoMaximoEsperaHoras: number | null;
  limiteInicioImpressao: string | null;
  criadoEm: Date;
  prioridadePaga: boolean;
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

function toNumber(value: unknown): number {
  return Number(value);
}

function toBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === "1" || value === "true";
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapPedidoOtimizacao(row: any): PedidoOtimizacaoRow {
  return {
    id: toNumber(row.id),
    idMaterial: toNumber(row.idMaterial),
    tempoGcodeHoras: toNumber(row.tempoGcodeHoras),
    prazoEntregaHoras: toNumber(row.prazoEntregaHoras),
    tempoMaximoEsperaHoras: toNullableNumber(row.tempoMaximoEsperaHoras),
    limiteInicioImpressao: row.limiteInicioImpressao ?? null,
    criadoEm: row.criadoEm,
    prioridadePaga: toBoolean(row.prioridadePaga),
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

  async findPendentesParaOtimizacao(): Promise<PedidoOtimizacaoRow[]> {
    const [rows] = await db.execute(`
      SELECT
        id,
        id_material AS idMaterial,
        tempo_gcode_horas AS tempoGcodeHoras,
        CASE
          WHEN prazo_entrega IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, NOW(), prazo_entrega) / 60
          ELSE prazo_entrega_horas
        END AS prazoEntregaHoras,
        CASE
          WHEN limite_inicio_impressao IS NOT NULL
            THEN TIMESTAMPDIFF(MINUTE, NOW(), limite_inicio_impressao) / 60
          WHEN tempo_maximo_espera_horas IS NOT NULL
            THEN tempo_maximo_espera_horas - TIMESTAMPDIFF(MINUTE, created_at, NOW()) / 60
          ELSE NULL
        END AS tempoMaximoEsperaHoras,
        DATE_FORMAT(limite_inicio_impressao, '%Y-%m-%d %H:%i:%s') AS limiteInicioImpressao,
        created_at AS criadoEm,
        prioridade_paga AS prioridadePaga
      FROM pedidos
      WHERE status = 'na_fila'
      ORDER BY created_at ASC, id ASC
      LIMIT 100
    `);

    return (rows as any[]).map(mapPedidoOtimizacao);
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

  async update(id: number, data: UpdatePedidoRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const vals: any[]      = [];

    if (data.preco       !== undefined) { campos.push("preco = ?");        vals.push(data.preco); }
    if (data.descricao   !== undefined) { campos.push("descricao = ?");    vals.push(data.descricao); }
    if (data.status      !== undefined) { campos.push("status = ?");       vals.push(data.status); }
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

    if (campos.length === 0) return;
    vals.push(id);
    await db.execute(`UPDATE pedidos SET ${campos.join(", ")} WHERE id = ?`, vals);
  }

  async delete(id: number): Promise<void> {
    await db.execute("DELETE FROM pedidos WHERE id = ?", [id]);
  }
}
