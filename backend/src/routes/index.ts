import { Router } from "express";
import { authRoutes } from "../modules/auth/auth.routes";
import { usuariosRoutes } from "../modules/usuarios/usuarios.routes";
import { materiaisRoutes } from "../modules/materiais/materiais.routes";
import { qualidadeImpressaoRoutes } from "../modules/qualidadeImpressao/qualidadeImpressao.routes";
import { arquivosRoutes } from "../modules/arquivos/arquivos.routes";
import { pedidosRoutes } from "../modules/pedidos/pedidos.routes";
import { impressorasRoutes } from "../modules/impressoras/impressoras.routes";
import { filaRoutes } from "../modules/fila/fila.routes";

const router = Router();

router.use("/auth", authRoutes);
router.use("/usuarios", usuariosRoutes);
router.use("/materiais", materiaisRoutes);
router.use("/qualidades", qualidadeImpressaoRoutes);
router.use("/arquivos", arquivosRoutes);
router.use("/pedidos", pedidosRoutes);
router.use("/impressoras", impressorasRoutes);
router.use("/fila", filaRoutes);

export { router };
