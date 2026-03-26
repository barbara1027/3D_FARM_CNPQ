import { Request, Response } from "express";
import { PedidoService } from "./pedidos.service";

export class PedidoController {
  constructor(private readonly pedidoService: PedidoService) {}

  listar = async (_req: Request, res: Response) => {
    try {
      const pedidos = await this.pedidoService.listar();
      return res.status(200).json(pedidos);
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

      const pedido = await this.pedidoService.buscarPorId(id);

      if (!pedido) {
        return res.status(404).json({ message: "Pedido não encontrado." });
      }

      return res.status(200).json(pedido);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const { nome, preco, descricao, idUsuario, idMaterial, idQualidade, idArquivo } = req.body;

      if (
        !nome ||
        preco === undefined ||
        idUsuario === undefined ||
        idMaterial === undefined ||
        idQualidade === undefined ||
        idArquivo === undefined
      ) {
        return res.status(400).json({
          message:
            "Os campos nome, preco, idUsuario, idMaterial, idQualidade e idArquivo são obrigatórios.",
        });
      }

      const pedido = await this.pedidoService.criar({
        nome,
        preco,
        descricao,
        idUsuario,
        idMaterial,
        idQualidade,
        idArquivo,
      });

      return res.status(201).json(pedido);
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

      const pedido = await this.pedidoService.atualizar(id, req.body);
      return res.status(200).json(pedido);
    } catch (error: any) {
      const statusCode = error.message === "Pedido não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const result = await this.pedidoService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Pedido não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
