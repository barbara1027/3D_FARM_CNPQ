import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface JwtPayload {
  sub: number;
  email: string;
  tipo: "admin" | "cliente";
  iat?: number;
  exp?: number;
}

// Augmenta o tipo do Request do Express para incluir jwtUser
// Usando express-serve-static-core (base do Express) evita conflito com @types/passport
declare module "express-serve-static-core" {
  interface Request {
    jwtUser?: JwtPayload;
  }
}

const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_troque_em_producao";
if (!process.env.JWT_SECRET) {
  console.warn("[AVISO] JWT_SECRET não definido — usando valor inseguro. Configure .env antes de ir para produção.");
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;

  if (!header || !header.startsWith("Bearer ")) {
    res.status(401).json({ message: "Token de autenticação não fornecido." });
    return;
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as JwtPayload;
    req.jwtUser = payload;
    next();
  } catch {
    res.status(401).json({ message: "Token inválido ou expirado." });
  }
}

export function adminMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (!req.jwtUser) {
    res.status(401).json({ message: "Não autenticado." });
    return;
  }
  if (req.jwtUser.tipo !== "admin") {
    res.status(403).json({ message: "Acesso restrito a administradores." });
    return;
  }
  next();
}
