import { Router } from "express";
import { ImpressoraController } from "./impressoras.controller";
import { ImpressoraService } from "./impressoras.service";
import { ImpressoraRepository } from "./impressoras.repository";

const impressorasRoutes = Router();

const impressoraRepository = new ImpressoraRepository();
const impressoraService = new ImpressoraService(impressoraRepository);
const impressoraController = new ImpressoraController(impressoraService);

impressorasRoutes.get("/", impressoraController.listar);
impressorasRoutes.get("/:id", impressoraController.buscarPorId);
impressorasRoutes.post("/", impressoraController.criar);
impressorasRoutes.put("/:id", impressoraController.atualizar);
impressorasRoutes.delete("/:id", impressoraController.remover);

export { impressorasRoutes };