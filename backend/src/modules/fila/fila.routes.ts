import { Router } from "express";
import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import { FilaController } from "./fila.controller";
import { FilaService } from "./fila.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const filaRoutes = Router();

const pedidoRepository = new PedidoRepository();
const impressoraRepository = new ImpressoraRepository();
const filaService = new FilaService(pedidoRepository, impressoraRepository);
const filaController = new FilaController(filaService);

filaRoutes.post("/reescalonar", authMiddleware, adminMiddleware, filaController.reescalonar);

export { filaRoutes };
