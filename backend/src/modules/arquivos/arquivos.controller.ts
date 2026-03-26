import { Request, Response } from "express";
import { ArquivoService } from "./arquivos.service";

export class ArquivoController {
  constructor(private readonly arquivoService: ArquivoService) {}

  listar = async (_req: Request, res: Response) => {
    try {
      const arquivos = await this.arquivoService.listar();
      return res.status(200).json(arquivos);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const arquivo = await this.arquivoService.buscarPorId(id);

      if (!arquivo) {
        return res.status(404).json({ message: "Arquivo não encontrado." });
      }

      return res.status(200).json(arquivo);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const { nome, tipo, caminho } = req.body;

      if (!nome || !tipo || !caminho) {
        return res.status(400).json({
          message: "Os campos nome, tipo e caminho são obrigatórios.",
        });
      }

      const arquivo = await this.arquivoService.criar({
        nome,
        tipo,
        caminho,
      });

      return res.status(201).json(arquivo);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const result = await this.arquivoService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Arquivo não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
