import { Request, Response } from "express";
import { PedidoService } from "./pedidos.service";

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

// Campos que o corpo da requisição pode conter mas que NUNCA são aceitos
// aqui, para nenhum papel — preço, ETA, prazos, buffers, complexidade e
// prioridade paga pertencem exclusivamente ao pipeline automático (Fase 1)
// ou a um caminho administrativo dedicado (Fase 9/24/25).
/**
 * Constrói o payload de atualização a partir do corpo da requisição,
 * filtrado pelo papel do usuário. Cliente comum só altera `descricao`
 * (e `status` para cancelamento, validado depois pelo service). Admin
 * também pode ajustar os campos físicos/comerciais do pedido — nunca os
 * campos calculados pelo pipeline. Extraída como função pura para não
 * depender de mocks de Express nos testes.
 */
export function construirPayloadAtualizacaoPedido(
  isAdmin: boolean,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { status: body.status };
  if (body.descricao !== undefined) payload.descricao = body.descricao;

  if (isAdmin) {
    if (body.idMaterial !== undefined) payload.idMaterial = parseOptionalNumber(body.idMaterial);
    if (body.idQualidade !== undefined) payload.idQualidade = parseOptionalNumber(body.idQualidade);
    if (body.idArquivo !== undefined) payload.idArquivo = parseOptionalNumber(body.idArquivo);
    if (body.parametros !== undefined) payload.parametros = body.parametros;
  }

  return payload;
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
  // Segurança (Fase 9/24): o cliente nunca pode informar preço, ETA, prazo,
  // buffers, complexidade calculada ou prioridade_paga — esses campos são
  // sempre derivados pelo backend (pipeline de slicing/ETA) ou setados por
  // um caminho administrativo dedicado. `criar` e `atualizar` só aceitam os
  // campos comerciais/físicos que o cliente legitimamente controla.
  criar = async (req: Request, res: Response) => {
    try {
      const { nome, descricao, idMaterial, idQualidade, idArquivo, parametros, quantidade } = req.body;
      const idUsuario = req.jwtUser!.sub;

      if (!nome || !idMaterial || !idQualidade || !idArquivo) {
        return res.status(400).json({
          message: "nome, idMaterial, idQualidade e idArquivo são obrigatórios.",
        });
      }

      const pedido = await this.service.criar({
        nome,
        descricao:   descricao   ?? null,
        idUsuario,
        idMaterial:  Number(idMaterial),
        idQualidade: Number(idQualidade),
        idArquivo:   Number(idArquivo),
        parametros:  parametros  ?? null,
        quantidade:  quantidade != null ? Math.max(1, Number(quantidade)) : 1,
        // prioridadePaga nunca vem do cliente — só um caminho administrativo
        // dedicado (ver PATCH /pedidos/:id/prioridade) pode ativá-la.
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
      const isAdmin = user.tipo === "admin";
      if (!isAdmin && existing.idUsuario !== user.sub) {
        return res.status(403).json({ message: "Acesso negado." });
      }

      const payload = construirPayloadAtualizacaoPedido(isAdmin, req.body ?? {});
      const p = await this.service.atualizar(id, payload);
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
