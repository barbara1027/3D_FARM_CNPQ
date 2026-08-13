import { Router } from "express";
import { ImpressoraController } from "./impressoras.controller";
import { ImpressoraRepository } from "./impressoras.repository";
import { ImpressoraService } from "./impressoras.service";
import { MaterialRepository } from "../materiais/materiais.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import { FilaService } from "../fila/fila.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";

const impressorasRoutes = Router();

const impressoraRepository = new ImpressoraRepository();
const filaService = new FilaService(new PedidoRepository(), impressoraRepository);
const impressoraService = new ImpressoraService(
  impressoraRepository,
  new MaterialRepository(),
  filaService,
);
const impressoraController = new ImpressoraController(impressoraService);

impressorasRoutes.get("/", authMiddleware, impressoraController.listar);
impressorasRoutes.get("/:id/progresso", authMiddleware, impressoraController.progresso);
impressorasRoutes.get("/:id/eventos", authMiddleware, impressoraController.listarEventos);
impressorasRoutes.get("/:id", authMiddleware, impressoraController.buscarPorId);
impressorasRoutes.post("/", authMiddleware, adminMiddleware, impressoraController.criar);
impressorasRoutes.post("/:id/testar-conexao", authMiddleware, adminMiddleware, impressoraController.testarConexao);
impressorasRoutes.post("/:id/sincronizar", authMiddleware, adminMiddleware, impressoraController.sincronizarStatus);
impressorasRoutes.post("/:id/atribuir-pedido", authMiddleware, adminMiddleware, impressoraController.atribuirPedido);
impressorasRoutes.post("/:id/liberar", authMiddleware, adminMiddleware, impressoraController.liberar);
impressorasRoutes.post("/:id/confirmar-remocao", authMiddleware, adminMiddleware, impressoraController.confirmarRemocao);
impressorasRoutes.patch("/:id", authMiddleware, adminMiddleware, impressoraController.atualizar);
impressorasRoutes.put("/:id/slots/:numeroSlot", authMiddleware, adminMiddleware, impressoraController.carregarFilamento);
impressorasRoutes.put("/:id", authMiddleware, adminMiddleware, impressoraController.atualizar);
impressorasRoutes.delete("/:id/slots/:numeroSlot", authMiddleware, adminMiddleware, impressoraController.descarregarFilamento);
impressorasRoutes.delete("/:id", authMiddleware, adminMiddleware, impressoraController.remover);

export { impressorasRoutes };
