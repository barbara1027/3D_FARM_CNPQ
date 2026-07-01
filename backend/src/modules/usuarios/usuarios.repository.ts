import { db } from "../../database/connection";

export type UsuarioTipo  = "admin" | "cliente";
export type UsuarioNivel = "iniciante" | "avancado";

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  senha_hash: string | null;
  google_id: string | null;
  avatar_url: string | null;
  tipo: UsuarioTipo;
  nivel: UsuarioNivel;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUsuarioRepositoryDTO {
  nome: string;
  email: string;
  senhaHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  tipo: UsuarioTipo;
  nivel?: UsuarioNivel;
}

export interface UpdateUsuarioRepositoryDTO {
  nome?: string;
  email?: string;
  senhaHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  tipo?: UsuarioTipo;
  nivel?: UsuarioNivel;
}

const SELECT = `
  SELECT
    id, nome, email, senha_hash, google_id, avatar_url, tipo, nivel,
    DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
    DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
  FROM usuarios
`;

export class UsuarioRepository {
  async findAll(): Promise<Usuario[]> {
    const [rows] = await db.execute(`${SELECT} ORDER BY id DESC`);
    return rows as Usuario[];
  }

  async findById(id: number): Promise<Usuario | null> {
    const [rows] = await db.execute(`${SELECT} WHERE id = ? LIMIT 1`, [id]);
    return (rows as Usuario[])[0] ?? null;
  }

  async findByEmail(email: string): Promise<Usuario | null> {
    const [rows] = await db.execute(`${SELECT} WHERE email = ? LIMIT 1`, [email]);
    return (rows as Usuario[])[0] ?? null;
  }

  async findByGoogleId(googleId: string): Promise<Usuario | null> {
    const [rows] = await db.execute(`${SELECT} WHERE google_id = ? LIMIT 1`, [googleId]);
    return (rows as Usuario[])[0] ?? null;
  }

  async create(data: CreateUsuarioRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO usuarios (nome, email, senha_hash, google_id, avatar_url, tipo, nivel)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      data.nome, data.email,
      data.senhaHash ?? null,
      data.googleId ?? null,
      data.avatarUrl ?? null,
      data.tipo,
      data.nivel ?? "iniciante",
    ]);
    return result.insertId;
  }

  async update(id: number, data: UpdateUsuarioRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.nome !== undefined) { campos.push("nome = ?"); valores.push(data.nome); }
    if (data.email !== undefined) { campos.push("email = ?"); valores.push(data.email); }
    if (data.senhaHash !== undefined) { campos.push("senha_hash = ?"); valores.push(data.senhaHash); }
    if (data.googleId !== undefined) { campos.push("google_id = ?"); valores.push(data.googleId); }
    if (data.avatarUrl !== undefined) { campos.push("avatar_url = ?"); valores.push(data.avatarUrl); }
    if (data.tipo  !== undefined) { campos.push("tipo = ?");  valores.push(data.tipo); }
    if (data.nivel !== undefined) { campos.push("nivel = ?"); valores.push(data.nivel); }

    if (campos.length === 0) return;
    valores.push(id);
    await db.execute(`UPDATE usuarios SET ${campos.join(", ")} WHERE id = ?`, valores);
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM usuarios WHERE id = ?`, [id]);
  }
}
