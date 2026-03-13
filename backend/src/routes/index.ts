import { Router } from "express";
import { usuariosRoutes } from "../modules/usuarios/usuarios.routes";
import { materiaisRoutes } from "../modules/materiais/materiais.routes";
import { impressorasRoutes } from "../modules/impressoras/impressoras.routes";
import { qualidadeImpressaoRoutes } from "../modules/qualidadeImpressao/qualidadeImpressao.routes";

const router = Router();

router.use("/usuarios", usuariosRoutes);
router.use("/materiais", materiaisRoutes);
router.use("/impressoras", impressorasRoutes);
router.use("/qualidades", qualidadeImpressaoRoutes);

export { router };