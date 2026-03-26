import { Request, Response } from "express";
import { QualidadeImpressaoService } from "./qualidadeImpressao.service";

export class QualidadeImpressaoController {
  constructor(
    private readonly qualidadeImpressaoService: QualidadeImpressaoService,
  ) {}

  listar = async (_req: Request, res: Response) => {
    try {
      const qualidades = await this.qualidadeImpressaoService.listar();
      return res.status(200).json(qualidades);
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

      const qualidade = await this.qualidadeImpressaoService.buscarPorId(id);

      if (!qualidade) {
        return res.status(404).json({ message: "Qualidade não encontrada." });
      }

      return res.status(200).json(qualidade);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const {
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperaturaBico,
        temperaturaMesa,
        suporte,
        adesao,
      } = req.body;

      if (
        altura === undefined ||
        espessura === undefined ||
        preenchimento === undefined ||
        velocidade === undefined ||
        temperaturaBico === undefined ||
        temperaturaMesa === undefined ||
        suporte === undefined ||
        adesao === undefined
      ) {
        return res.status(400).json({
          message:
            "Os campos altura, espessura, preenchimento, velocidade, temperaturaBico, temperaturaMesa, suporte e adesao são obrigatórios.",
        });
      }

      const qualidade = await this.qualidadeImpressaoService.criar({
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperaturaBico,
        temperaturaMesa,
        suporte,
        adesao,
      });

      return res.status(201).json(qualidade);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const {
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperaturaBico,
        temperaturaMesa,
        suporte,
        adesao,
      } = req.body;

      const qualidade = await this.qualidadeImpressaoService.atualizar(id, {
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperaturaBico,
        temperaturaMesa,
        suporte,
        adesao,
      });

      return res.status(200).json(qualidade);
    } catch (error: any) {
      const statusCode = error.message === "Qualidade não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const result = await this.qualidadeImpressaoService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Qualidade não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
