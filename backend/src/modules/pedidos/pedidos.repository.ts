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
  // campos JOIN
  nomeUsuario?: string;
  emailUsuario?: string;
  nomeMaterial?: string;
  nomeArquivo?: string;
  caminhoArquivo?: string;
  idArquivoGcode?: number | null;
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
}

export interface UpdatePedidoRepositoryDTO {
  preco?: number;
  descricao?: string | null;
  status?: StatusPedido;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  parametros?: Record<string, any> | null;
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
    return rows as Pedido[];
  }

  async findByUsuario(idUsuario: number): Promise<Pedido[]> {
    const [rows] = await db.execute(
      `${SEL} WHERE p.id_usuario = ? ORDER BY p.id DESC`, [idUsuario]
    );
    return rows as Pedido[];
  }

  async findById(id: number): Promise<Pedido | null> {
    const [rows] = await db.execute(`${SEL} WHERE p.id = ? LIMIT 1`, [id]);
    return (rows as Pedido[])[0] ?? null;
  }

  async create(data: CreatePedidoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO pedidos
        (nome, preco, descricao, id_usuario, id_material, id_qualidade, id_arquivo, status, parametros, quantidade)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

    if (campos.length === 0) return;
    vals.push(id);
    await db.execute(`UPDATE pedidos SET ${campos.join(", ")} WHERE id = ?`, vals);
  }

  async delete(id: number): Promise<void> {
    await db.execute("DELETE FROM pedidos WHERE id = ?", [id]);
  }
}
