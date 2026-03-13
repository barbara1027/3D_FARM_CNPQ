import { Router } from "express";
import { MaterialController } from "./materiais.controller";
import { MaterialService } from "./materiais.service";
import { MaterialRepository } from "./materiais.repository";

const materiaisRoutes = Router();

const materialRepository = new MaterialRepository();
const materialService = new MaterialService(materialRepository);
const materialController = new MaterialController(materialService);

materiaisRoutes.get("/", materialController.listar);
materiaisRoutes.get("/:id", materialController.buscaPorId);
materiaisRoutes.post("/", materialController.criar);
materiaisRoutes.put("/:id", materialController.atualizar);
materiaisRoutes.delete("/:id", materialController.remover);

export { materiaisRoutes };