import { Router } from "express";
import { MaterialController } from "./materiais.controller";
import { MaterialRepository } from "./materiais.repository";
import { MaterialService } from "./materiais.service";

const materiaisRoutes = Router();

const materialRepository = new MaterialRepository();
const materialService = new MaterialService(materialRepository);
const materialController = new MaterialController(materialService);

materiaisRoutes.get("/", materialController.listar);
materiaisRoutes.get("/:id", materialController.buscarPorId);
materiaisRoutes.post("/", materialController.criar);
materiaisRoutes.put("/:id", materialController.atualizar);
materiaisRoutes.delete("/:id", materialController.remover);

export { materiaisRoutes };
