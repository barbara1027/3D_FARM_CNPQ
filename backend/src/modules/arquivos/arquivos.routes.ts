import path from "path";
import { Router, Request, Response } from "express";
import { ArquivoController, upload } from "./arquivos.controller";
import { ArquivoRepository } from "./arquivos.repository";
import { ArquivoService } from "./arquivos.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";
import { db } from "../../database/connection";

const arquivosRoutes = Router();

const arquivoRepository = new ArquivoRepository();
const arquivoService = new ArquivoService(arquivoRepository);
const arquivoController = new ArquivoController(arquivoService);

arquivosRoutes.get("/", authMiddleware, arquivoController.listar);

/** GET /arquivos/:id/download — serve qualquer arquivo (STL ou GCode) com verificação de acesso */
arquivosRoutes.get("/:id/download", authMiddleware, async (req: Request, res: Response) => {
  const id   = Number(req.params.id);
  const user = req.jwtUser!;
  if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });

  const arquivo = await arquivoRepository.findById(id);
  if (!arquivo) return res.status(404).json({ message: "Arquivo não encontrado." });

  // Verificação de acesso: admin sempre pode; cliente apenas se o pedido for dele
  if (user.tipo !== "admin") {
    if (!arquivo.idPedido) return res.status(403).json({ message: "Acesso negado." });
    const [rows]: any = await db.execute(
      "SELECT id_usuario FROM pedidos WHERE id = ? LIMIT 1", [arquivo.idPedido]
    );
    if (!rows?.length || rows[0].id_usuario !== user.sub) {
      return res.status(403).json({ message: "Acesso negado." });
    }
  }

  // Path traversal guard
  const BASE_DIR  = path.resolve(process.cwd());
  const resolved  = path.resolve(arquivo.caminho);
  if (!resolved.startsWith(BASE_DIR + path.sep) && resolved !== BASE_DIR) {
    return res.status(403).json({ message: "Acesso negado." });
  }

  const ext      = path.extname(arquivo.nome) || (arquivo.tipo === "stl" ? ".stl" : ".gcode");
  const safeName = arquivo.nome.replace(/[^a-z0-9._-]/gi, "_");
  res.setHeader("Content-Disposition", `attachment; filename="${safeName}"`);
  res.setHeader("Content-Type", "application/octet-stream");
  return res.sendFile(resolved, (err) => {
    if (err) res.status(404).json({ message: "Arquivo não encontrado no servidor." });
  });
});

arquivosRoutes.get("/:id", authMiddleware, arquivoController.buscarPorId);
arquivosRoutes.post("/upload", authMiddleware, upload.single("arquivo"), arquivoController.uploadArquivo);
arquivosRoutes.delete("/:id", authMiddleware, adminMiddleware, arquivoController.remover);

export { arquivosRoutes };
