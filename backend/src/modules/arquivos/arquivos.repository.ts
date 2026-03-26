import { db } from "../../database/connection";

export type TipoArquivo = "stl" | "gcode";

export interface Arquivo {
  id: number;
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
}

export interface CreateArquivoRepositoryDTO {
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
}

export class ArquivoRepository {
  async findAll(): Promise<Arquivo[]> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        nome,
        tipo,
        caminho
      FROM arquivos
      ORDER BY id DESC
      `,
    );

    return rows as Arquivo[];
  }

  async findById(id: number): Promise<Arquivo | null> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        nome,
        tipo,
        caminho
      FROM arquivos
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    const arquivos = rows as Arquivo[];
    return arquivos[0] ?? null;
  }

  async create(data: CreateArquivoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `
      INSERT INTO arquivos (
        nome,
        tipo,
        caminho
      )
      VALUES (?, ?, ?)
      `,
      [data.nome, data.tipo, data.caminho],
    );

    return result.insertId;
  }

  async delete(id: number): Promise<void> {
    await db.execute(
      `
      DELETE FROM arquivos
      WHERE id = ?
      `,
      [id],
    );
  }
}
