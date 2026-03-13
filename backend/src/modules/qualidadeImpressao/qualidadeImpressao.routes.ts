import { Router } from "express";
import { QualidadeImpressaoController } from "./qualidadeImpressao.controller";
import { QualidadeImpressaoService } from "./qualidadeImpressao.service";
import { QualidadeImpressaoRepository } from "./qualidadeImpressao.repository";

const qualidadeImpressaoRoutes = Router();

const qualidadeImpressaoRepository = new QualidadeImpressaoRepository();
const qualidadeImpressaoService = new QualidadeImpressaoService(
  qualidadeImpressaoRepository
);
const qualidadeImpressaoController = new QualidadeImpressaoController(
  qualidadeImpressaoService
);

qualidadeImpressaoRoutes.get("/", qualidadeImpressaoController.listar);
qualidadeImpressaoRoutes.get("/:id", qualidadeImpressaoController.buscarPorId);
qualidadeImpressaoRoutes.post("/", qualidadeImpressaoController.criar);
qualidadeImpressaoRoutes.put("/:id", qualidadeImpressaoController.atualizar);
qualidadeImpressaoRoutes.delete("/:id", qualidadeImpressaoController.remover);

export { qualidadeImpressaoRoutes };