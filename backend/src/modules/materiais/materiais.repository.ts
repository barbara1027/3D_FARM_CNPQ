import { db } from "../../database/connection";

export type MaterialStatus = "disponivel" | "indisponivel";

export interface Material {
  id: number;
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
}

export interface CreateMaterialRepositoryDTO {
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
}

export interface UpdateMaterialRepositoryDTO {
  nome?: string;
  tipo?: string;
  preco?: number;
  status?: MaterialStatus;
  cor?: string;
}

export class MaterialRepository {
  async findAll(): Promise<Material[]> {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM materiais
      ORDER BY id DESC
      `,
    );

    return rows as Material[];
  }

  async findById(id: number): Promise<Material | null> {
    const [rows] = await db.execute(
      `
      SELECT *
      FROM materiais
      WHERE id = ?
      LIMIT 1
      `,
      [id],
    );

    const materiais = rows as Material[];
    return materiais[0] ?? null;
  }

  async create(data: CreateMaterialRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `
      INSERT INTO materiais (
        nome,
        tipo,
        preco,
        status,
        cor
      )
      VALUES (?, ?, ?, ?, ?)
      `,
      [data.nome, data.tipo, data.preco, data.status, data.cor],
    );

    return result.insertId;
  }

  async update(id: number, data: UpdateMaterialRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: unknown[] = [];

    if (data.nome !== undefined) {
      campos.push("nome = ?");
      valores.push(data.nome);
    }

    if (data.tipo !== undefined) {
      campos.push("tipo = ?");
      valores.push(data.tipo);
    }

    if (data.preco !== undefined) {
      campos.push("preco = ?");
      valores.push(data.preco);
    }

    if (data.status !== undefined) {
      campos.push("status = ?");
      valores.push(data.status);
    }

    if (data.cor !== undefined) {
      campos.push("cor = ?");
      valores.push(data.cor);
    }

    if (campos.length === 0) {
      return;
    }

    valores.push(id);

    await db.execute(
      `
      UPDATE materiais
      SET ${campos.join(", ")}
      WHERE id = ?
      `,
      valores,
    );
  }

  async delete(id: number): Promise<void> {
    await db.execute(
      `
      DELETE FROM materiais
      WHERE id = ?
      `,
      [id],
    );
  }
}
