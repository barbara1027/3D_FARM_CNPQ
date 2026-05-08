import { db } from "../../database/connection";

export type StatusPedido =
  | "na_fila"
  | "em_impressao"
  | "concluido"
  | "falhou"
  | "cancelado";

export interface Pedido {
  id: number;
  nome: string;
  preco: number;
  descricao: string | null;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  status: StatusPedido;
  tempoGcodeHoras: number;
  prazoEntregaHoras: number;
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
  preco: number;
  descricao?: string;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  status: StatusPedido;
  tempoGcodeHoras: number;
  prazoEntregaHoras: number;
  prazoEntrega: string | Date;
  etaHorasEstimado: number;
  etaCalculadoEm: string | Date;
  prazoEntregaOriginal: string | Date;
  limiteInicioImpressao: string | Date;
  prioridadePaga?: boolean;
  tempoMaximoEsperaHoras: number;
  bufferPrioridadeHoras: number;
  bufferSegurancaHoras: number;
  tempoExecFarmHoras: number;
}

export interface UpdatePedidoRepositoryDTO {
  preco?: number;
  descricao?: string | null;
  idUsuario?: number;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  status?: StatusPedido;
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

function mapPedido(row: any): Pedido {
  return {
    ...row,
    id: toNumber(row.id),
    preco: toNumber(row.preco),
    idUsuario: toNumber(row.idUsuario),
    idMaterial: toNumber(row.idMaterial),
    idQualidade: toNumber(row.idQualidade),
    idArquivo: toNumber(row.idArquivo),
    tempoGcodeHoras: toNumber(row.tempoGcodeHoras),
    prazoEntregaHoras: toNumber(row.prazoEntregaHoras),
    prazoEntrega: row.prazoEntrega ?? null,
    etaHorasEstimado: toNullableNumber(row.etaHorasEstimado),
    etaCalculadoEm: row.etaCalculadoEm ?? null,
    prazoEntregaOriginal: row.prazoEntregaOriginal ?? null,
    limiteInicioImpressao: row.limiteInicioImpressao ?? null,
    prioridadePaga: toBoolean(row.prioridadePaga),
    tempoMaximoEsperaHoras: toNullableNumber(row.tempoMaximoEsperaHoras),
    bufferPrioridadeHoras: toNullableNumber(row.bufferPrioridadeHoras),
    bufferSegurancaHoras: toNullableNumber(row.bufferSegurancaHoras),
    tempoExecFarmHoras: toNullableNumber(row.tempoExecFarmHoras),
  } as Pedido;
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

function selectPedidoColumns() {
  return `
    SELECT
      id,
      nome,
      preco,
      descricao,
      id_usuario AS idUsuario,
      id_material AS idMaterial,
      id_qualidade AS idQualidade,
      id_arquivo AS idArquivo,
      status,
      tempo_gcode_horas AS tempoGcodeHoras,
      prazo_entrega_horas AS prazoEntregaHoras,
      DATE_FORMAT(prazo_entrega, '%Y-%m-%d %H:%i:%s') AS prazoEntrega,
      eta_horas_estimado AS etaHorasEstimado,
      DATE_FORMAT(eta_calculado_em, '%Y-%m-%d %H:%i:%s') AS etaCalculadoEm,
      DATE_FORMAT(prazo_entrega_original, '%Y-%m-%d %H:%i:%s') AS prazoEntregaOriginal,
      DATE_FORMAT(limite_inicio_impressao, '%Y-%m-%d %H:%i:%s') AS limiteInicioImpressao,
      prioridade_paga AS prioridadePaga,
      tempo_maximo_espera_horas AS tempoMaximoEsperaHoras,
      buffer_prioridade_horas AS bufferPrioridadeHoras,
      buffer_seguranca_horas AS bufferSegurancaHoras,
      tempo_exec_farm_horas AS tempoExecFarmHoras
    FROM pedidos
  `;
}

export class PedidoRepository {
  async findAll(): Promise<Pedido[]> {
    const [rows] = await db.execute(
      `${selectPedidoColumns()} ORDER BY id DESC`,
    );

    return (rows as any[]).map(mapPedido);
  }

  async findById(id: number): Promise<Pedido | null> {
    const [rows] = await db.execute(
      `${selectPedidoColumns()} WHERE id = ? LIMIT 1`,
      [id],
    );

    const pedidos = (rows as any[]).map(mapPedido);
    return pedidos[0] ?? null;
  }

  async findByUsuario(idUsuario: number): Promise<Pedido[]> {
    const [rows] = await db.execute(
      `${selectPedidoColumns()} WHERE id_usuario = ? ORDER BY id DESC`,
      [idUsuario],
    );

    return (rows as any[]).map(mapPedido);
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
    const [result] = await db.execute(
      `
      INSERT INTO pedidos (
        nome,
        preco,
        descricao,
        id_usuario,
        id_material,
        id_qualidade,
        id_arquivo,
        status,
        tempo_gcode_horas,
        prazo_entrega_horas,
        prazo_entrega,
        eta_horas_estimado,
        eta_calculado_em,
        prazo_entrega_original,
        limite_inicio_impressao,
        prioridade_paga,
        tempo_maximo_espera_horas,
        buffer_prioridade_horas,
        buffer_seguranca_horas,
        tempo_exec_farm_horas
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, FALSE), ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.preco,
        data.descricao ?? null,
        data.idUsuario,
        data.idMaterial,
        data.idQualidade,
        data.idArquivo,
        data.status,
        data.tempoGcodeHoras,
        data.prazoEntregaHoras,
        data.prazoEntrega,
        data.etaHorasEstimado,
        data.etaCalculadoEm,
        data.prazoEntregaOriginal,
        data.limiteInicioImpressao,
        data.prioridadePaga ?? null,
        data.tempoMaximoEsperaHoras,
        data.bufferPrioridadeHoras,
        data.bufferSegurancaHoras,
        data.tempoExecFarmHoras,
      ],
    );

    return (result as any).insertId;
  }

  async update(id: number, data: UpdatePedidoRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: unknown[] = [];

    if (data.preco !== undefined) {
      campos.push("preco = ?");
      valores.push(data.preco);
    }

    if (data.descricao !== undefined) {
      campos.push("descricao = ?");
      valores.push(data.descricao);
    }

    if (data.idUsuario !== undefined) {
      campos.push("id_usuario = ?");
      valores.push(data.idUsuario);
    }

    if (data.idMaterial !== undefined) {
      campos.push("id_material = ?");
      valores.push(data.idMaterial);
    }

    if (data.idQualidade !== undefined) {
      campos.push("id_qualidade = ?");
      valores.push(data.idQualidade);
    }

    if (data.idArquivo !== undefined) {
      campos.push("id_arquivo = ?");
      valores.push(data.idArquivo);
    }

    if (data.status !== undefined) {
      campos.push("status = ?");
      valores.push(data.status);
    }

    if (data.tempoGcodeHoras !== undefined) {
      campos.push("tempo_gcode_horas = ?");
      valores.push(data.tempoGcodeHoras);
    }

    if (data.prazoEntregaHoras !== undefined) {
      campos.push("prazo_entrega_horas = ?");
      valores.push(data.prazoEntregaHoras);
    }

    if (data.prazoEntrega !== undefined) {
      campos.push("prazo_entrega = ?");
      valores.push(data.prazoEntrega);
    }

    if (data.etaHorasEstimado !== undefined) {
      campos.push("eta_horas_estimado = ?");
      valores.push(data.etaHorasEstimado);
    }

    if (data.etaCalculadoEm !== undefined) {
      campos.push("eta_calculado_em = ?");
      valores.push(data.etaCalculadoEm);
    }

    if (data.prazoEntregaOriginal !== undefined) {
      campos.push("prazo_entrega_original = ?");
      valores.push(data.prazoEntregaOriginal);
    }

    if (data.limiteInicioImpressao !== undefined) {
      campos.push("limite_inicio_impressao = ?");
      valores.push(data.limiteInicioImpressao);
    }

    if (data.prioridadePaga !== undefined) {
      campos.push("prioridade_paga = ?");
      valores.push(data.prioridadePaga);
    }

    if (data.tempoMaximoEsperaHoras !== undefined) {
      campos.push("tempo_maximo_espera_horas = ?");
      valores.push(data.tempoMaximoEsperaHoras);
    }

    if (data.bufferPrioridadeHoras !== undefined) {
      campos.push("buffer_prioridade_horas = ?");
      valores.push(data.bufferPrioridadeHoras);
    }

    if (data.bufferSegurancaHoras !== undefined) {
      campos.push("buffer_seguranca_horas = ?");
      valores.push(data.bufferSegurancaHoras);
    }

    if (data.tempoExecFarmHoras !== undefined) {
      campos.push("tempo_exec_farm_horas = ?");
      valores.push(data.tempoExecFarmHoras);
    }

    if (campos.length === 0) {
      return;
    }

    valores.push(id);

    await db.execute(
      `UPDATE pedidos SET ${campos.join(", ")} WHERE id = ?`,
      valores,
    );
  }

  async delete(id: number): Promise<void> {
    await db.execute("DELETE FROM pedidos WHERE id = ?", [id]);
  }
}
