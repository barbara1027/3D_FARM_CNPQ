import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UsuarioController } from "./usuarios.controller";
import { UsuarioRepository } from "./usuarios.repository";
import { UsuarioService } from "./usuarios.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const usuariosRoutes = Router();

const usuariosRepository = new UsuarioRepository();
const usuariosService = new UsuarioService(usuariosRepository);
const usuariosController = new UsuarioController(usuariosService);

// Escopo restrito ao cadastro público em si — antes ficava em app.ts
// aplicado a todo o prefixo /usuarios, o que também limitava GET/PUT/DELETE
// autenticados (uso administrativo normal) ao mesmo teto de cadastros/hora.
const cadastroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de cadastros atingido. Tente novamente em 1 hora." },
});

// Cadastro público (cliente cria própria conta)
usuariosRoutes.post("/", cadastroLimiter, usuariosController.criar);

// Rotas protegidas
usuariosRoutes.get("/", authMiddleware, adminMiddleware, usuariosController.listar);
usuariosRoutes.get("/:id", authMiddleware, usuariosController.buscarPorId);
usuariosRoutes.put("/:id", authMiddleware, usuariosController.atualizar);
usuariosRoutes.delete("/:id", authMiddleware, adminMiddleware, usuariosController.remover);

export { usuariosRoutes };
