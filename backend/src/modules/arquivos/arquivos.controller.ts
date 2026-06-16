import path from "path";
import fs from "fs";
import { Request, Response } from "express";
import multer from "multer";
import { ArquivoService } from "./arquivos.service";

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? "uploads";

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${unique}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = [".stl", ".gcode", ".gco", ".g"];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Apenas arquivos .stl e .gcode são permitidos."));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 200 * 1024 * 1024 },
});

export class ArquivoController {
  constructor(private readonly arquivoService: ArquivoService) {}

  /**
   * @swagger
   * /arquivos:
   *   get:
   *     tags: [Arquivos]
   *     summary: Lista todos os arquivos
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de arquivos
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Arquivo'
   */
  listar = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.arquivoService.listar());
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /arquivos/{id}:
   *   get:
   *     tags: [Arquivos]
   *     summary: Busca arquivo por ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Arquivo encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Arquivo'
   *       404:
   *         description: Arquivo não encontrado
   */
  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const arquivo = await this.arquivoService.buscarPorId(id);
      if (!arquivo) return res.status(404).json({ message: "Arquivo não encontrado." });
      return res.status(200).json(arquivo);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /arquivos/upload:
   *   post:
   *     tags: [Arquivos]
   *     summary: Faz upload de um arquivo STL ou G-code
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         multipart/form-data:
   *           schema:
   *             type: object
   *             required: [arquivo]
   *             properties:
   *               arquivo:
   *                 type: string
   *                 format: binary
   *     responses:
   *       201:
   *         description: Upload realizado com sucesso
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Arquivo'
   *       400:
   *         description: Tipo de arquivo não permitido
   */
  uploadArquivo = async (req: Request, res: Response) => {
    try {
      const file = req.file;
      if (!file) return res.status(400).json({ message: "Nenhum arquivo enviado." });

      const ext = path.extname(file.originalname).toLowerCase();
      const tipo = ext === ".stl" ? "stl" : "gcode";
      const tamanhoMb = file.size / (1024 * 1024);

      const arquivo = await this.arquivoService.criar({
        nome: file.originalname,
        tipo,
        caminho: file.path,
        tamanhoMb,
      });

      return res.status(201).json(arquivo);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /arquivos/{id}:
   *   delete:
   *     tags: [Arquivos]
   *     summary: Remove um arquivo
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Arquivo removido
   *       404:
   *         description: Arquivo não encontrado
   */
  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.arquivoService.remover(id));
    } catch (error: any) {
      const statusCode = error.message === "Arquivo não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
