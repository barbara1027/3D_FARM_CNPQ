import { Router, Request, Response, NextFunction } from "express";
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
 * Callback do Google OAuth precisa bater exatamente com a URL usada na
 * autorização inicial. Em vez de um valor fixo em GOOGLE_CALLBACK_URL (que
 * quebra quando a farm é acessada por um IP de rede local em vez de
 * "localhost"), reconstruímos a partir do host da própria requisição —
 * assim funciona tanto em localhost quanto em qualquer IP pelo qual o
 * backend for acessado, desde que essa URL também esteja cadastrada como
 * redirect URI autorizada no Google Cloud Console.
 */
function resolverGoogleCallbackUrl(req: Request): string {
  return `${req.protocol}://${req.get("host")}/auth/google/callback`;
}

/**
 * O frontend roda na mesma máquina/host do backend, só que em outra porta
 * (padrão 5173). Reaproveitamos o hostname da requisição atual (localhost
 * ou o IP da rede local, o que o usuário estiver usando) e só trocamos a
 * porta pela configurada em FRONTEND_URL — assim o redirect final do login
 * sempre volta para o mesmo host que o usuário já estava usando.
 */
function resolverFrontendOrigin(req: Request): string {
  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
  const porta = new URL(frontendUrl).port || "5173";
  return `${req.protocol}://${req.hostname}:${porta}`;
}

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
authRoutes.get("/google", (req: Request, res: Response, next: NextFunction) => {
  // callbackURL não está nos tipos de @types/passport-google-oauth20, mas é
  // uma opção real repassada até passport-oauth2 (ver node_modules/passport-oauth2/lib/strategy.js).
  passport.authenticate("google", {
    scope: ["profile", "email"],
    callbackURL: resolverGoogleCallbackUrl(req),
  } as passport.AuthenticateOptions)(req, res, next);
});

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
authRoutes.get("/google/callback", (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate(
    "google",
    { session: false, callbackURL: resolverGoogleCallbackUrl(req) } as passport.AuthenticateOptions,
    (err: unknown, usuario: any) => {
      if (err || !usuario) {
        return res.redirect(`${resolverFrontendOrigin(req)}/login?erro=google_falhou`);
      }
      const nivel: "iniciante" | "avancado" = usuario.nivel ?? "iniciante";
      const token = gerarToken({
        id: usuario.id,
        email: usuario.email,
        tipo: usuario.tipo,
        nivel,
      });
      res.redirect(
        `${resolverFrontendOrigin(req)}/auth/callback#token=${token}&tipo=${usuario.tipo}&nivel=${nivel}`,
      );
    },
  )(req, res, next);
});

authRoutes.get("/google/error", (req: Request, res: Response) => {
  res.redirect(`${resolverFrontendOrigin(req)}/login?erro=google_falhou`);
});

export { authRoutes };
