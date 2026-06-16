import { Router } from "express";
import { QualidadeImpressaoController } from "./qualidadeImpressao.controller";
import { QualidadeImpressaoRepository } from "./qualidadeImpressao.repository";
import { QualidadeImpressaoService } from "./qualidadeImpressao.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const qualidadeImpressaoRoutes = Router();

const qualidadeImpressaoRepository = new QualidadeImpressaoRepository();
const qualidadeImpressaoService = new QualidadeImpressaoService(qualidadeImpressaoRepository);
const qualidadeImpressaoController = new QualidadeImpressaoController(qualidadeImpressaoService);

// Leitura pública
qualidadeImpressaoRoutes.get("/", qualidadeImpressaoController.listar);
qualidadeImpressaoRoutes.get("/:id", qualidadeImpressaoController.buscarPorId);

// Escrita só para admin
qualidadeImpressaoRoutes.post("/", authMiddleware, adminMiddleware, qualidadeImpressaoController.criar);
qualidadeImpressaoRoutes.put("/:id", authMiddleware, adminMiddleware, qualidadeImpressaoController.atualizar);
qualidadeImpressaoRoutes.delete("/:id", authMiddleware, adminMiddleware, qualidadeImpressaoController.remover);

export { qualidadeImpressaoRoutes };
