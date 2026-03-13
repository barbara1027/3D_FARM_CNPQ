import { Router } from "express";
import { UsuarioController } from "./usuarios.controller";
import { UsuarioService } from "./usuarios.service";
import { UsuarioRepositiry } from "./usuarios.repository";

const usuariosRoutes = Router();

const usuariosRepository = new UsuarioRepositiry();
const usuariosService = new UsuarioService(usuariosRepository);
const usuariosController = new UsuarioController(usuariosService);

usuariosRoutes.get("/", usuariosController.listar);
usuariosRoutes.get("/:id", usuariosController.buscarPorId);
usuariosRoutes.post("/", usuariosController.criar);
usuariosRoutes.put("/:id", usuariosController.atualizar);
usuariosRoutes.delete("/:id", usuariosController.remover);

export { usuariosRoutes };