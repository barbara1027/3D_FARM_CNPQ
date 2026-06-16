import { Router } from "express";
import { UsuarioController } from "./usuarios.controller";
import { UsuarioRepository } from "./usuarios.repository";
import { UsuarioService } from "./usuarios.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const usuariosRoutes = Router();

const usuariosRepository = new UsuarioRepository();
const usuariosService = new UsuarioService(usuariosRepository);
const usuariosController = new UsuarioController(usuariosService);

// Cadastro público (cliente cria própria conta)
usuariosRoutes.post("/", usuariosController.criar);

// Rotas protegidas
usuariosRoutes.get("/", authMiddleware, adminMiddleware, usuariosController.listar);
usuariosRoutes.get("/:id", authMiddleware, usuariosController.buscarPorId);
usuariosRoutes.put("/:id", authMiddleware, usuariosController.atualizar);
usuariosRoutes.delete("/:id", authMiddleware, adminMiddleware, usuariosController.remover);

export { usuariosRoutes };
