import { db } from "../../database/connection";

export type TipoArquivo = "stl" | "gcode";

export interface Arquivo {
  id: number;
  idPedido: number | null;
  idUsuario: number | null;
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
  tamanhoMb: number;
  createdAt: string;
}

export interface CreateArquivoRepositoryDTO {
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
  tamanhoMb?: number;
  idPedido?: number | null;
  idUsuario?: number | null;
}

export class ArquivoRepository {
  private static readonly SEL = `
    SELECT
      id,
      id_pedido  AS idPedido,
      id_usuario AS idUsuario,
      nome,
      tipo,
      caminho,
      tamanho_mb AS tamanhoMb,
      DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
    FROM arquivos
  `;

  async findAll(): Promise<Arquivo[]> {
    const [rows] = await db.execute(`${ArquivoRepository.SEL} ORDER BY id DESC`);
    return rows as Arquivo[];
  }

  /** Arquivos pertencentes a um usuário específico (cliente comum — Fase 29). */
  async findByUsuario(idUsuario: number): Promise<Arquivo[]> {
    const [rows] = await db.execute(
      `${ArquivoRepository.SEL} WHERE id_usuario = ? ORDER BY id DESC`, [idUsuario]
    );
    return rows as Arquivo[];
  }

  async findById(id: number): Promise<Arquivo | null> {
    const [rows] = await db.execute(
      `${ArquivoRepository.SEL} WHERE id = ? LIMIT 1`, [id]
    );

    const arquivos = rows as Arquivo[];
    return arquivos[0] ?? null;
  }

  async create(data: CreateArquivoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `INSERT INTO arquivos (id_pedido, id_usuario, nome, tipo, caminho, tamanho_mb) VALUES (?, ?, ?, ?, ?, ?)`,
      [data.idPedido ?? null, data.idUsuario ?? null, data.nome, data.tipo, data.caminho, data.tamanhoMb ?? 0]
    );
    return result.insertId;
  }

  /**
   * Upsert GCode: remove registro anterior do pedido e insere novo. O
   * proprietário do G-code é sempre o dono do pedido (não quem aciona o
   * pipeline), resolvido diretamente por subquery.
   */
  async upsertGcode(idPedido: number, caminho: string, tamanhoMb: number): Promise<number> {
    await db.execute(
      `DELETE FROM arquivos WHERE id_pedido = ? AND tipo = 'gcode'`,
      [idPedido]
    );
    const [result]: any = await db.execute(
      `INSERT INTO arquivos (id_pedido, id_usuario, nome, tipo, caminho, tamanho_mb)
       SELECT ?, id_usuario, ?, 'gcode', ?, ?
       FROM pedidos WHERE id = ?`,
      [idPedido, `pedido_${idPedido}.gcode`, caminho, tamanhoMb, idPedido]
    );
    return result.insertId;
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM arquivos WHERE id = ?`, [id]);
  }
}
