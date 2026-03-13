import { db } from "../../database/connection";

export type UsuarioTipo = "admin" | "cliente";

export interface Usuario {
    id :number;
    nome: string;
    email: string;
    senha_hash: string;
    tipo: UsuarioTipo;
}

export interface CreateUsuarioRepositoryDTO {
    nome: string;
    email: string;
    senhaHash: string;
    tipo: UsuarioTipo;
}

export interface UpdateUsuarioRepositoryDTO {
    nome?: string;
    email?: string;
    senhaHash?: string;
    tipo?: UsuarioTipo;
}

export class UsuarioRepositiry {
    async findAll(): Promise<Usuario[]> {
        const [rows] = await db.execute(
            `
            SELET id,nome,email,senha_hash,tipo
            FROM usuarios
            ORDER BY id DESC
            `
        );
        return rows as Usuario[];
    }
    async findById(id: number): Promise<Usuario | null> {
        const [rows] = await db.execute(
        `
            SELECT id, nome, email, senha_hash, tipo, created_at, updated_at
            FROM usuarios
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        const usuarios = rows as Usuario[];
        return usuarios[0] ?? null;
    }

    async findByemail(email: string): Promise<Usuario | null>{
        const [rows] = await db.execute(
            `
            SELET id,nome,email,senha_hash,tipo
            FROM usuarios
            WHERE email = ?
            LIMIT 1
            `,
            [email]
        );
        const usuarios = rows as Usuario[];
        return usuarios[0] ?? null;
    }
    
    async create(data: CreateUsuarioRepositoryDTO): Promise<number> {
        const [result]: any = await db.execute(
            `
            INSERT INTO usarios (
                nome,
                email,
                senha_hash,
                tipo
            )
            VALUES(?,?,?,?)
            `,
            [data.nome, data.email, data.senhaHash, data.tipo]
        );

        return result.insertId;
    }
    
    async update(id: number, data: UpdateUsuarioRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.nome !== undefined) {
      campos.push("nome = ?");
      valores.push(data.nome);
    }

    if (data.email !== undefined) {
      campos.push("email = ?");
      valores.push(data.email);
    }

    if (data.senhaHash !== undefined) {
      campos.push("senha_hash = ?");
      valores.push(data.senhaHash);
    }

    if (data.tipo !== undefined) {
      campos.push("tipo = ?");
      valores.push(data.tipo);
    }

    if (campos.length === 0) {
      return;
    }

    valores.push(id);

    await db.execute(
      `
      UPDATE usuarios
      SET ${campos.join(", ")}
      WHERE id = ?
      `,
      valores
    );
  }

  async delete(id: number): Promise<void> {
    await db.execute(
      `
      DELETE FROM usuarios
      WHERE id = ?
      `,
      [id]
    );
  }
}


