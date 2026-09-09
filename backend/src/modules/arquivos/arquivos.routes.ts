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

  // Verificação de acesso (Fase 29): admin sempre pode; cliente comum
  // precisa ser o dono direto do arquivo OU dono do pedido associado
  // (cobre arquivos enviados antes da coluna id_usuario existir).
  if (user.tipo !== "admin" && arquivo.idUsuario !== user.sub) {
    if (!arquivo.idPedido) return res.status(403).json({ message: "Acesso negado." });
    const [rows]: any = await db.execute(
      "SELECT id_usuario FROM pedidos WHERE id = ? LIMIT 1", [arquivo.idPedido]
    );
    if (!rows?.length || rows[0].id_usuario !== user.sub) {
      return res.status(403).json({ message: "Acesso negado." });
    }
  }

  // Path traversal guard — restringe aos diretórios de armazenamento
  // configurados (STL em UPLOAD_DIR, G-code em GCODE_DIR), não a
  // process.cwd(): quando qualquer um dos dois é um caminho absoluto fora da
  // pasta do backend, comparar com process.cwd() rejeitava até o dono
  // legítimo do arquivo.
  const UPLOAD_BASE_DIR = path.resolve(process.env.UPLOAD_DIR ?? "uploads");
  const GCODE_BASE_DIR  = path.resolve(process.env.GCODE_DIR ?? "gcode_storage");
  const resolved = path.resolve(arquivo.caminho);
  const dentroDeUmDiretorioPermitido =
    resolved === UPLOAD_BASE_DIR || resolved.startsWith(UPLOAD_BASE_DIR + path.sep) ||
    resolved === GCODE_BASE_DIR  || resolved.startsWith(GCODE_BASE_DIR + path.sep);
  if (!dentroDeUmDiretorioPermitido) {
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
