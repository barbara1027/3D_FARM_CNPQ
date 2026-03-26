import { Router } from "express";
import { ImpressoraController } from "./impressoras.controller";
import { ImpressoraRepository } from "./impressoras.repository";
import { ImpressoraService } from "./impressoras.service";

const impressorasRoutes = Router();

const impressoraRepository = new ImpressoraRepository();
const impressoraService = new ImpressoraService(impressoraRepository);
const impressoraController = new ImpressoraController(impressoraService);

impressorasRoutes.get("/", impressoraController.listar);
impressorasRoutes.get("/:id", impressoraController.buscarPorId);
impressorasRoutes.get("/:id/eventos", impressoraController.listarEventos);
impressorasRoutes.post("/", impressoraController.criar);
impressorasRoutes.post("/:id/testar-conexao", impressoraController.testarConexao);
impressorasRoutes.post("/:id/sincronizar", impressoraController.sincronizarStatus);
impressorasRoutes.post("/:id/atribuir-pedido", impressoraController.atribuirPedido);
impressorasRoutes.post("/:id/liberar", impressoraController.liberar);
impressorasRoutes.put("/:id", impressoraController.atualizar);
impressorasRoutes.delete("/:id", impressoraController.remover);

export { impressorasRoutes };
