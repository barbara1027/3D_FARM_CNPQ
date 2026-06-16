import { db } from "../../database/connection";

export type TipoArquivo = "stl" | "gcode";

export interface Arquivo {
  id: number;
  idPedido: number | null;
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
}

export class ArquivoRepository {
  private static readonly SEL = `
    SELECT
      id,
      id_pedido  AS idPedido,
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

  async findById(id: number): Promise<Arquivo | null> {
    const [rows] = await db.execute(
      `${ArquivoRepository.SEL} WHERE id = ? LIMIT 1`, [id]
    );

    const arquivos = rows as Arquivo[];
    return arquivos[0] ?? null;
  }

  async create(data: CreateArquivoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `INSERT INTO arquivos (id_pedido, nome, tipo, caminho, tamanho_mb) VALUES (?, ?, ?, ?, ?)`,
      [data.idPedido ?? null, data.nome, data.tipo, data.caminho, data.tamanhoMb ?? 0]
    );
    return result.insertId;
  }

  /** Upsert GCode: remove registro anterior do pedido e insere novo. */
  async upsertGcode(idPedido: number, caminho: string, tamanhoMb: number): Promise<number> {
    await db.execute(
      `DELETE FROM arquivos WHERE id_pedido = ? AND tipo = 'gcode'`,
      [idPedido]
    );
    const [result]: any = await db.execute(
      `INSERT INTO arquivos (id_pedido, nome, tipo, caminho, tamanho_mb) VALUES (?, ?, 'gcode', ?, ?)`,
      [idPedido, `pedido_${idPedido}.gcode`, caminho, tamanhoMb]
    );
    return result.insertId;
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM arquivos WHERE id = ?`, [id]);
  }
}
