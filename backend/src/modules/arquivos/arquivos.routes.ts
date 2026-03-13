import { Router } from "express";
import { ArquivoController } from "./arquivos.controller";
import { ArquivoRepository } from "./arquivos.repository";
import { ArquivoService } from "./arquivos.service";

const arquivosRoutes = Router();

const arquivoRepository = new ArquivoRepository();
const arquivoService = new ArquivoService(arquivoRepository);
const arquivoController = new ArquivoController(arquivoService);

arquivosRoutes.get("/", arquivoController.listar);
arquivosRoutes.get("/:id", arquivoController.buscarPorId);
arquivosRoutes.post("/", arquivoController.criar);
arquivosRoutes.delete("/:id", arquivoController.remover);

export { arquivosRoutes };