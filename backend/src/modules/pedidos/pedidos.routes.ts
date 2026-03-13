import { Router } from "express";
import { PedidoRepository } from "./pedidos.repository";
import { PedidoService } from "./pedidos.service";
import { PedidoController } from "./pedidos.controller";

const pedidosRoutes = Router();

const pedidoRepository = new PedidoRepository();
const pedidoService = new PedidoService(pedidoRepository);
const pedidoController = new PedidoController(pedidoService);

pedidosRoutes.get("/", pedidoController.listar);
pedidosRoutes.get("/:id", pedidoController.buscarPorId);
pedidosRoutes.post("/", pedidoController.criar);
pedidosRoutes.put("/:id", pedidoController.atualizar);
pedidosRoutes.delete("/:id", pedidoController.remover);

export { pedidosRoutes };