import { Router } from "express";

import { materiaisRoutes } from "../modules/materiais/materiais.routes";
import { usuariosRoutes } from "../modules/usuarios/usuarios.routes";

const router = Router();

router.use("/materiais", materiaisRoutes);
router.use("/usuarios", usuariosRoutes);

export { router };