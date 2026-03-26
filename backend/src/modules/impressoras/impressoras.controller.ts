import { Request, Response } from "express";
import { ImpressoraService } from "./impressoras.service";

function parseId(value: string): number {
  return Number(value);
}

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
      const id = parseId(req.params.id);

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
      const {
        nome,
        modelo,
        status,
        ip,
        baseUrl,
        api,
        api_key,
        timeoutMs,
        idMaterial,
        id_impressora,
      } = req.body;
      const materialIdNormalizado = idMaterial ?? id_impressora ?? null;

      if (!nome || !modelo || !api) {
        return res.status(400).json({
          message: "Os campos nome, modelo e api são obrigatórios.",
        });
      }

      const impressora = await this.impressoraService.criar({
        nome,
        modelo,
        status,
        ip: ip ?? null,
        baseUrl: baseUrl ?? null,
        api,
        api_key: api_key ?? null,
        timeoutMs: timeoutMs ? Number(timeoutMs) : undefined,
        idMaterial: materialIdNormalizado,
      });

      return res.status(201).json(impressora);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  atualizar = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const {
        nome,
        modelo,
        status,
        ip,
        baseUrl,
        api,
        api_key,
        timeoutMs,
        idMaterial,
        id_impressora,
      } = req.body;
      const materialIdNormalizado = idMaterial ?? id_impressora;

      const impressora = await this.impressoraService.atualizar(id, {
        nome,
        modelo,
        status,
        ip,
        baseUrl,
        api,
        api_key,
        timeoutMs: timeoutMs !== undefined ? Number(timeoutMs) : undefined,
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
      const id = parseId(req.params.id);

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

  testarConexao = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const resultado = await this.impressoraService.testarConexao(id);
      return res.status(200).json(resultado);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  sincronizarStatus = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const impressora = await this.impressoraService.sincronizarStatus(id);
      return res.status(200).json(impressora);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  atribuirPedido = async (req: Request, res: Response) => {
    try {
      const idImpressora = parseId(req.params.id);
      const idPedido = Number(req.body.idPedido ?? req.body.id_pedido);

      if (Number.isNaN(idImpressora) || Number.isNaN(idPedido)) {
        return res.status(400).json({ message: "IDs inválidos." });
      }

      const resultado = await this.impressoraService.atribuirPedido(idImpressora, idPedido);
      return res.status(200).json(resultado);
    } catch (error: any) {
      const message = error.message ?? "Erro interno.";
      const statusCode = message.includes("não encontrada") ? 404 : 400;
      return res.status(statusCode).json({ message });
    }
  };

  liberar = async (req: Request, res: Response) => {
    try {
      const idImpressora = parseId(req.params.id);
      if (Number.isNaN(idImpressora)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const impressora = await this.impressoraService.liberar(idImpressora);
      return res.status(200).json(impressora);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  listarEventos = async (req: Request, res: Response) => {
    try {
      const idImpressora = parseId(req.params.id);
      const limit = req.query.limit ? Number(req.query.limit) : 20;

      if (Number.isNaN(idImpressora)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const eventos = await this.impressoraService.listarEventos(idImpressora, limit);
      return res.status(200).json(eventos);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
