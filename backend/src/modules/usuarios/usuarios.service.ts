import bcrypt from "bcrypt";
import { Usuario, UsuarioRepository, UsuarioTipo, UsuarioNivel } from "./usuarios.repository";

export type UsuarioPublico = Omit<Usuario, "senha_hash" | "google_id">;

export interface CreateUsuarioServiceDTO {
  nome: string;
  email: string;
  senha?: string;
  tipo?: UsuarioTipo;
  nivel?: UsuarioNivel;
}

export interface UpdateUsuarioServiceDTO {
  nome?: string;
  email?: string;
  senha?: string;
  tipo?: UsuarioTipo;
  nivel?: UsuarioNivel;
}

export interface UpsertGoogleUsuarioDTO {
  googleId: string;
  email: string;
  nome: string;
  avatarUrl?: string | null;
}

function omitSenha(u: Usuario): UsuarioPublico {
  const { senha_hash: _s, google_id: _g, ...rest } = u;
  return rest;
}

export class UsuarioService {
  constructor(private readonly usuarioRepository: UsuarioRepository) {}

  async listar(): Promise<UsuarioPublico[]> {
    return (await this.usuarioRepository.findAll()).map(omitSenha);
  }

  async buscarPorId(id: number): Promise<UsuarioPublico | null> {
    const u = await this.usuarioRepository.findById(id);
    return u ? omitSenha(u) : null;
  }

  async criar(data: CreateUsuarioServiceDTO): Promise<UsuarioPublico> {
    if (await this.usuarioRepository.findByEmail(data.email)) {
      throw new Error("Já existe um usuário com este email.");
    }
    const senhaHash = data.senha ? await bcrypt.hash(data.senha, 10) : null;
    const id = await this.usuarioRepository.create({
      nome: data.nome,
      email: data.email,
      senhaHash,
      tipo: data.tipo ?? "cliente",
      nivel: data.nivel ?? "iniciante",
    });
    const criado = await this.usuarioRepository.findById(id);
    if (!criado) throw new Error("Erro ao buscar usuário recém-criado.");
    return omitSenha(criado);
  }

  // Cria ou atualiza usuário via Google OAuth
  async upsertGoogle(data: UpsertGoogleUsuarioDTO): Promise<UsuarioPublico> {
    // Já tem conta Google
    const porGoogle = await this.usuarioRepository.findByGoogleId(data.googleId);
    if (porGoogle) {
      await this.usuarioRepository.update(porGoogle.id, {
        nome: data.nome,
        avatarUrl: data.avatarUrl ?? null,
      });
      const atualizado = await this.usuarioRepository.findById(porGoogle.id);
      return omitSenha(atualizado!);
    }

    // Tem conta por email — vincular Google
    const porEmail = await this.usuarioRepository.findByEmail(data.email);
    if (porEmail) {
      await this.usuarioRepository.update(porEmail.id, {
        googleId: data.googleId,
        avatarUrl: data.avatarUrl ?? null,
      });
      const atualizado = await this.usuarioRepository.findById(porEmail.id);
      return omitSenha(atualizado!);
    }

    // Nova conta
    const id = await this.usuarioRepository.create({
      nome: data.nome,
      email: data.email,
      googleId: data.googleId,
      avatarUrl: data.avatarUrl ?? null,
      tipo: "cliente",
    });
    const criado = await this.usuarioRepository.findById(id);
    return omitSenha(criado!);
  }

  async atualizar(id: number, data: UpdateUsuarioServiceDTO): Promise<UsuarioPublico> {
    const usuario = await this.usuarioRepository.findById(id);
    if (!usuario) throw new Error("Usuário não encontrado.");
    if (data.email && data.email !== usuario.email) {
      if (await this.usuarioRepository.findByEmail(data.email)) {
        throw new Error("Este email já está em uso.");
      }
    }
    const senhaHash = data.senha ? await bcrypt.hash(data.senha, 10) : undefined;
    await this.usuarioRepository.update(id, {
      nome: data.nome,
      email: data.email,
      senhaHash,
      tipo: data.tipo,
      nivel: data.nivel,
    });
    const atualizado = await this.usuarioRepository.findById(id);
    if (!atualizado) throw new Error("Erro ao buscar usuário atualizado.");
    return omitSenha(atualizado);
  }

  async remover(id: number): Promise<{ message: string }> {
    if (!(await this.usuarioRepository.findById(id))) throw new Error("Usuário não encontrado.");
    await this.usuarioRepository.delete(id);
    return { message: "Usuário removido com sucesso." };
  }
}
