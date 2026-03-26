import { Request, Response } from "express";
import { ImpressoraService } from "./impressoras.service";

export class ImpressoraController {
  constructor(private readonly impressoraService: ImpressoraService) {}

  listar = async (_req: Request, res: Response) => {
    try {
      const impressoras = await this.impressoraService.listar();
      return res.status(200).json(impressoras);
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

      const impressora = await this.impressoraService.buscarPorId(id);

      if (!impressora) {
        return res.status(404).json({ message: "Impressora não encontrada." });
      }

      return res.status(200).json(impressora);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const { nome, modelo, status, ip, api, api_key, idMaterial, id_impressora } = req.body;
      const materialIdNormalizado = idMaterial ?? id_impressora ?? null;

      if (!nome || !modelo || !status || !api) {
        return res.status(400).json({
          message: "Os campos nome, modelo, status e api são obrigatórios.",
        });
      }

      const impressora = await this.impressoraService.criar({
        nome,
        modelo,
        status,
        ip: ip ?? null,
        api,
        api_key: api_key ?? null,
        idMaterial: materialIdNormalizado,
      });

      return res.status(201).json(impressora);
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

      const { nome, modelo, status, ip, api, api_key, idMaterial, id_impressora } = req.body;
      const materialIdNormalizado = idMaterial ?? id_impressora;

      const impressora = await this.impressoraService.atualizar(id, {
        nome,
        modelo,
        status,
        ip,
        api,
        api_key,
        idMaterial: materialIdNormalizado,
      });

      return res.status(200).json(impressora);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const result = await this.impressoraService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
