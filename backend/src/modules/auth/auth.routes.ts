import { Router, Request, Response } from "express";
import passport from "passport";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { UsuarioRepository } from "../usuarios/usuarios.repository";
import { authMiddleware } from "../../middleware/auth.middleware";
import { gerarToken } from "./auth.service";

const authRoutes = Router();

const usuarioRepository = new UsuarioRepository();
const authService = new AuthService(usuarioRepository);
const authController = new AuthController(authService);

authRoutes.post("/login", authController.login);
authRoutes.get("/me", authMiddleware, authController.me);

/**
 * @swagger
 * /auth/google:
 *   get:
 *     tags: [Auth]
 *     summary: Inicia o fluxo de autenticação com Google
 *     responses:
 *       302:
 *         description: Redirect para o Google
 */
authRoutes.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     tags: [Auth]
 *     summary: Callback do Google OAuth
 *     responses:
 *       302:
 *         description: Redirect para o frontend com token JWT
 */
authRoutes.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/auth/google/error" }),
  (req: Request, res: Response) => {
    // req.user aqui é o UsuarioPublico populado pelo google.strategy.ts
    const usuario = req.user as any;
    const token = gerarToken({
      id: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo,
    });
    const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&tipo=${usuario.tipo}`);
  }
);

authRoutes.get("/google/error", (_req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  res.redirect(`${frontendUrl}/login?erro=google_falhou`);
});

export { authRoutes };
