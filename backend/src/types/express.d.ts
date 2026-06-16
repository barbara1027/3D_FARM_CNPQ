// Extensões globais do Express.Request
// Este arquivo é carregado automaticamente pelo TypeScript (via include no tsconfig)
// e garante que req.jwtUser esteja disponível em todos os controllers.

import type { JwtPayload } from "../middleware/auth.middleware";

declare global {
  namespace Express {
    interface Request {
      jwtUser?: JwtPayload;
    }
  }
}

export {};
