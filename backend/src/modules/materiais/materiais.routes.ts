import { Router } from "express";
import { MaterialController } from "./materiais.controller";
import { MaterialRepository } from "./materiais.repository";
import { MaterialService } from "./materiais.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const materiaisRoutes = Router();

const materialRepository = new MaterialRepository();
const materialService = new MaterialService(materialRepository);
const materialController = new MaterialController(materialService);

// Leitura pública (frontend precisa para montar formulário sem login)
materiaisRoutes.get("/", materialController.listar);
materiaisRoutes.get("/:id", materialController.buscarPorId);

// Escrita só para admin
materiaisRoutes.post("/", authMiddleware, adminMiddleware, materialController.criar);
materiaisRoutes.put("/:id", authMiddleware, adminMiddleware, materialController.atualizar);
materiaisRoutes.delete("/:id", authMiddleware, adminMiddleware, materialController.remover);

export { materiaisRoutes };
