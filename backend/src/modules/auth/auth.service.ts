import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UsuarioRepository } from "../usuarios/usuarios.repository";
import { UsuarioPublico } from "../usuarios/usuarios.service";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_troque_em_producao";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "7d";

export interface LoginDTO {
  email: string;
  senha: string;
}

export interface LoginResult {
  token: string;
  tipo: "admin" | "cliente";
  usuario: UsuarioPublico;
}

// Hash bcrypt de formato válido que nunca corresponde a nenhuma senha real —
// usado só para que bcrypt.compare sempre rode com o mesmo custo, mesmo
// quando o e-mail não existe ou a conta não tem senha (Google). Sem isso, a
// resposta para "e-mail inexistente" (falha antes do bcrypt) é
// mensuravelmente mais rápida que "senha errada" (roda o bcrypt inteiro),
// permitindo enumerar contas só pelo tempo de resposta.
const HASH_SEM_CORRESPONDENCIA =
  "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export function gerarToken(usuario: { id: number; email: string; tipo: "admin" | "cliente"; nivel: "iniciante" | "avancado" }): string {
  return jwt.sign(
    { sub: usuario.id, email: usuario.email, tipo: usuario.tipo, nivel: usuario.nivel },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions
  );
}

export class AuthService {
  constructor(private readonly usuarioRepository: UsuarioRepository) {}

  async login(data: LoginDTO): Promise<LoginResult> {
    const usuario = await this.usuarioRepository.findByEmail(data.email);

    // Roda sempre, antes de qualquer branch de erro — ver HASH_SEM_CORRESPONDENCIA.
    const senhaValida = await bcrypt.compare(
      data.senha,
      usuario?.senha_hash ?? HASH_SEM_CORRESPONDENCIA,
    );

    if (!usuario) throw new Error("Credenciais inválidas.");

    // Conta criada pelo Google sem senha
    if (!usuario.senha_hash) {
      throw new Error("Esta conta foi criada com o Google. Use o botão 'Entrar com Google'.");
    }

    if (!senhaValida) throw new Error("Credenciais inválidas.");

    const { senha_hash, ...usuarioPublico } = usuario;
    const token = gerarToken({ id: usuario.id, email: usuario.email, tipo: usuario.tipo, nivel: usuario.nivel });

    return { token, tipo: usuario.tipo, usuario: usuarioPublico };
  }
}
