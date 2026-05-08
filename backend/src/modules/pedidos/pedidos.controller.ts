import { Request, Response } from "express";
import { PedidoService } from "./pedidos.service";

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return value === true || value === 1 || value === "1" || value === "true";
}

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
        return res.status(400).json({ message: "ID invalido." });
      }

      const pedido = await this.pedidoService.buscarPorId(id);

      if (!pedido) {
        return res.status(404).json({ message: "Pedido nao encontrado." });
      }

      return res.status(200).json(pedido);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const {
        nome,
        preco,
        descricao,
        idUsuario,
        idMaterial,
        idQualidade,
        idArquivo,
        tempoGcodeHoras,
        prioridadePaga,
      } = req.body;

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
            "Os campos nome, preco, idUsuario, idMaterial, idQualidade e idArquivo sao obrigatorios.",
        });
      }

      const tempoGcodeHorasNormalizado = parseOptionalNumber(tempoGcodeHoras);

      if (!tempoGcodeHorasNormalizado || tempoGcodeHorasNormalizado <= 0) {
        return res.status(400).json({
          message: "tempoGcodeHoras e obrigatorio para calcular o prazo de entrega.",
        });
      }

      const pedido = await this.pedidoService.criar({
        nome,
        preco: Number(preco),
        descricao,
        idUsuario: Number(idUsuario),
        idMaterial: Number(idMaterial),
        idQualidade: Number(idQualidade),
        idArquivo: Number(idArquivo),
        tempoGcodeHoras: tempoGcodeHorasNormalizado,
        prioridadePaga: parseOptionalBoolean(prioridadePaga),
      });

      return res.status(201).json(pedido);
    } catch (error: any) {
      const message = error.message ?? "Erro ao criar pedido.";
      const statusCode = message.startsWith("Nao foi possivel calcular") ? 409 : 500;
      return res.status(statusCode).json({ message });
    }
  };

  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID invalido." });
      }

      const pedido = await this.pedidoService.atualizar(id, {
        preco: parseOptionalNumber(req.body.preco),
        descricao: req.body.descricao,
        idUsuario: parseOptionalNumber(req.body.idUsuario),
        idMaterial: parseOptionalNumber(req.body.idMaterial),
        idQualidade: parseOptionalNumber(req.body.idQualidade),
        idArquivo: parseOptionalNumber(req.body.idArquivo),
        status: req.body.status,
        tempoGcodeHoras: parseOptionalNumber(req.body.tempoGcodeHoras),
        prazoEntregaHoras: parseOptionalNumber(req.body.prazoEntregaHoras),
        prazoEntrega: req.body.prazoEntrega,
        prioridadePaga: parseOptionalBoolean(req.body.prioridadePaga),
      });

      return res.status(200).json(pedido);
    } catch (error: any) {
      const statusCode = error.message === "Pedido nao encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID invalido." });
      }

      const result = await this.pedidoService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Pedido nao encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
