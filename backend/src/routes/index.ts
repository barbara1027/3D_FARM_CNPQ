import { Router } from "express";
import { arquivosRoutes } from "../modules/arquivos/arquivos.routes";
import { filaRoutes } from "../modules/fila/fila.routes";
import { impressorasRoutes } from "../modules/impressoras/impressoras.routes";
import { materiaisRoutes } from "../modules/materiais/materiais.routes";
import { pedidosRoutes } from "../modules/pedidos/pedidos.routes";
import { qualidadeImpressaoRoutes } from "../modules/qualidadeImpressao/qualidadeImpressao.routes";
import { usuariosRoutes } from "../modules/usuarios/usuarios.routes";

const router = Router();

router.use("/usuarios", usuariosRoutes);
router.use("/materiais", materiaisRoutes);
router.use("/impressoras", impressorasRoutes);
router.use("/qualidades", qualidadeImpressaoRoutes);
router.use("/pedidos", pedidosRoutes);
router.use("/arquivos", arquivosRoutes);
router.use("/fila", filaRoutes);

export { router };
