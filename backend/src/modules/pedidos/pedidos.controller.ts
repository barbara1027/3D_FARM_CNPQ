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
  constructor(private readonly service: PedidoService) {}

  listar = async (req: Request, res: Response) => {
    try {
      const user = req.jwtUser!;
      const list = user.tipo === "admin"
        ? await this.service.listar()
        : await this.service.listarPorUsuario(user.sub);
      return res.status(200).json(list);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  };

  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const p = await this.service.buscarPorId(id);
      if (!p) return res.status(404).json({ message: "Pedido não encontrado." });
      const user = req.jwtUser!;
      if (user.tipo !== "admin" && p.idUsuario !== user.sub) {
        return res.status(403).json({ message: "Acesso negado." });
      }
      return res.status(200).json(p);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  };

  /**
   * @swagger
   * /pedidos:
   *   post:
   *     tags: [Pedidos]
   *     summary: Cria um pedido e inicia análise automática com PrusaSlicer
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [nome, idMaterial, idQualidade, idArquivo]
   *             properties:
   *               nome:        { type: string }
   *               descricao:   { type: string }
   *               idMaterial:  { type: integer }
   *               idQualidade: { type: integer }
   *               idArquivo:   { type: integer }
   *               parametros:
   *                 type: object
   *                 description: Parâmetros de impressão (layerHeight, infill, supports...)
   *     responses:
   *       201:
   *         description: Pedido criado — análise em andamento (status=analisando)
   */
  criar = async (req: Request, res: Response) => {
    try {
      const { nome, descricao, idMaterial, idQualidade, idArquivo, parametros, quantidade, prioridadePaga } = req.body;
      const idUsuario = req.jwtUser!.sub;

      if (!nome || !idMaterial || !idQualidade || !idArquivo) {
        return res.status(400).json({
          message: "nome, idMaterial, idQualidade e idArquivo são obrigatórios.",
        });
      }

      const pedido = await this.service.criar({
        nome,
        descricao:      descricao   ?? null,
        idUsuario,
        idMaterial:     Number(idMaterial),
        idQualidade:    Number(idQualidade),
        idArquivo:      Number(idArquivo),
        parametros:     parametros  ?? null,
        quantidade:     quantidade != null ? Math.max(1, Number(quantidade)) : 1,
        prioridadePaga: parseOptionalBoolean(prioridadePaga),
      });

      return res.status(201).json(pedido);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  };

  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const existing = await this.service.buscarPorId(id);
      if (!existing) return res.status(404).json({ message: "Pedido não encontrado." });
      const user = req.jwtUser!;
      if (user.tipo !== "admin" && existing.idUsuario !== user.sub) {
        return res.status(403).json({ message: "Acesso negado." });
      }
      const p = await this.service.atualizar(id, {
        ...req.body,
        preco:             parseOptionalNumber(req.body.preco),
        idUsuario:         parseOptionalNumber(req.body.idUsuario),
        idMaterial:        parseOptionalNumber(req.body.idMaterial),
        idQualidade:       parseOptionalNumber(req.body.idQualidade),
        idArquivo:         parseOptionalNumber(req.body.idArquivo),
        tempoGcodeHoras:   parseOptionalNumber(req.body.tempoGcodeHoras),
        prazoEntregaHoras: parseOptionalNumber(req.body.prazoEntregaHoras),
        prioridadePaga:    parseOptionalBoolean(req.body.prioridadePaga),
      });
      return res.status(200).json(p);
    } catch (e: any) {
      return res.status(e.message === "Pedido não encontrado." ? 404 : 500)
        .json({ message: e.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.service.remover(id));
    } catch (e: any) {
      return res.status(e.message === "Pedido não encontrado." ? 404 : 500)
        .json({ message: e.message });
    }
  };
}
