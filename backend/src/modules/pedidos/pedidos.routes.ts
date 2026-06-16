import path from "path";
import { Router, Request, Response } from "express";
import { PedidoController } from "./pedidos.controller";
import { PedidoRepository } from "./pedidos.repository";
import { PedidoService } from "./pedidos.service";
import { authMiddleware, adminMiddleware } from "../../middleware/auth.middleware";
import { criarSessaoCheckout } from './pagamentos.service';
import { db } from "../../database/connection";

const pedidosRoutes = Router();

const repo       = new PedidoRepository();
const service    = new PedidoService(repo);
const controller = new PedidoController(service);

// CRUD
pedidosRoutes.get("/",     authMiddleware, controller.listar);
pedidosRoutes.get("/:id",  authMiddleware, controller.buscarPorId);
pedidosRoutes.post("/",    authMiddleware, controller.criar);
pedidosRoutes.put("/:id",  authMiddleware, controller.atualizar);
pedidosRoutes.delete("/:id", authMiddleware, adminMiddleware, controller.remover);

/**
 * @swagger
 * /pedidos/{id}/gcode:
 *   get:
 *     tags: [Pedidos]
 *     summary: Download do G-code gerado para o pedido
 *     security:
 *       - bearerAuth: []
 */
pedidosRoutes.get("/:id/gcode", authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });

  try {
    const [rows]: any = await db.execute(
      "SELECT gcode_path, nome, id_usuario FROM pedidos WHERE id = ? LIMIT 1", [id]
    );
    if (!rows?.length) return res.status(404).json({ message: "Pedido não encontrado." });

    const { gcode_path, nome, id_usuario } = rows[0];

    // Ownership check — cliente só acessa o próprio G-code
    const user = req.jwtUser!;
    if (user.tipo !== "admin" && id_usuario !== user.sub) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    if (!gcode_path) return res.status(404).json({ message: "G-code ainda não gerado." });

    // Path traversal guard — garante que o arquivo está dentro do diretório esperado
    const GCODE_DIR = path.resolve(process.env.GCODE_DIR ?? "gcode_storage");
    const resolvedPath = path.resolve(gcode_path as string);
    if (!resolvedPath.startsWith(GCODE_DIR + path.sep) && resolvedPath !== GCODE_DIR) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const filename = `${(nome as string).replace(/[^a-z0-9]/gi, "_")}_${id}.gcode`;
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "text/plain");
    return res.sendFile(resolvedPath, (err) => {
      if (err) res.status(404).json({ message: "Arquivo G-code não encontrado no servidor." });
    });
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/**
 * @swagger
 * /pedidos/{id}/aprovar:
 *   post:
 *     tags: [Pedidos]
 *     summary: Admin aprova pedido complexo (aguardando_revisao → aguardando_pagamento)
 *     security:
 *       - bearerAuth: []
 */
pedidosRoutes.post("/:id/aprovar", authMiddleware, adminMiddleware,
  async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });

    try {
      const { preco } = req.body;
      const campos: string[] = ["status = 'aguardando_pagamento'", "updated_at = NOW()"];
      const vals: any[] = [];

      if (preco !== undefined) {
        const precoNum = Number(preco);
        if (isNaN(precoNum) || precoNum < 0) {
          return res.status(400).json({ message: "Preço inválido: deve ser um número não-negativo." });
        }
        campos.push("preco = ?");
        vals.push(precoNum);
      }

      vals.push(id);
      await db.execute(
        `UPDATE pedidos SET ${campos.join(", ")} WHERE id = ? AND status = 'aguardando_revisao'`,
        vals
      );

      const [rows]: any = await db.execute(
        "SELECT id, status, preco FROM pedidos WHERE id = ? LIMIT 1", [id]
      );
      return res.status(200).json(rows[0] ?? { message: "Pedido não estava em aguardando_revisao." });
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  }
);

// ── Chat por pedido ────────────────────────────────────────────────────────────

/**
 * GET /pedidos/mensagens/conversas
 * Lista todas as conversas ativas com preview da última mensagem e não lidas.
 */
pedidosRoutes.get("/mensagens/conversas", authMiddleware, async (req: Request, res: Response) => {
  const user = req.jwtUser!;
  const selAdmin = `
    SELECT
      p.id   AS idPedido, p.nome AS nomePedido,
      u.nome AS nomeCliente, u.email AS emailCliente,
      (SELECT cm2.mensagem FROM chat_mensagens cm2
       WHERE cm2.id_pedido = p.id ORDER BY cm2.criado_em DESC LIMIT 1) AS ultimaMensagem,
      DATE_FORMAT(MAX(cm.criado_em), '%Y-%m-%dT%H:%i:%sZ') AS ultimaMensagemEm,
      SUM(CASE WHEN cm.tipo_remetente = 'cliente' AND cm.lido = 0 THEN 1 ELSE 0 END) AS naoLidas
    FROM pedidos p
    JOIN chat_mensagens cm ON cm.id_pedido = p.id
    JOIN usuarios u ON u.id = p.id_usuario
    GROUP BY p.id, p.nome, u.nome, u.email
    ORDER BY ultimaMensagemEm DESC
  `;
  const selCliente = `
    SELECT
      p.id AS idPedido, p.nome AS nomePedido,
      (SELECT cm2.mensagem FROM chat_mensagens cm2
       WHERE cm2.id_pedido = p.id ORDER BY cm2.criado_em DESC LIMIT 1) AS ultimaMensagem,
      DATE_FORMAT(MAX(cm.criado_em), '%Y-%m-%dT%H:%i:%sZ') AS ultimaMensagemEm,
      SUM(CASE WHEN cm.tipo_remetente = 'admin' AND cm.lido = 0 THEN 1 ELSE 0 END) AS naoLidas
    FROM pedidos p
    JOIN chat_mensagens cm ON cm.id_pedido = p.id
    WHERE p.id_usuario = ?
    GROUP BY p.id, p.nome
    ORDER BY ultimaMensagemEm DESC
  `;
  try {
    const [rows]: any = user.tipo === "admin"
      ? await db.execute(selAdmin)
      : await db.execute(selCliente, [user.sub]);
    return res.json((rows as any[]).map((r: any) => ({ ...r, naoLidas: Number(r.naoLidas) })));
  } catch (e: any) {
    return res.status(500).json({ message: e.message });
  }
});

/**
 * GET /pedidos/mensagens/resumo
 * Retorna todos os pedidos com mensagens não lidas do outro lado (uma query só).
 * Cliente recebe mensagens do admin; admin recebe mensagens dos clientes.
 */
pedidosRoutes.get("/mensagens/resumo", authMiddleware, async (req: Request, res: Response) => {
  const user = req.jwtUser!;
  let rows: any;

  if (user.tipo === "admin") {
    [rows] = await db.execute(`
      SELECT cm.id_pedido AS idPedido, COUNT(*) AS count
      FROM chat_mensagens cm
      WHERE cm.tipo_remetente = 'cliente' AND cm.lido = 0
      GROUP BY cm.id_pedido
    `);
  } else {
    [rows] = await db.execute(`
      SELECT cm.id_pedido AS idPedido, COUNT(*) AS count
      FROM chat_mensagens cm
      JOIN pedidos p ON p.id = cm.id_pedido
      WHERE p.id_usuario = ? AND cm.tipo_remetente = 'admin' AND cm.lido = 0
      GROUP BY cm.id_pedido
    `, [user.sub]);
  }

  return res.json((rows as any[]).map(r => ({
    idPedido: Number(r.idPedido),
    count:    Number(r.count),
  })));
});

const CHAT_SEL = `
  SELECT
    cm.id, cm.id_pedido AS idPedido, cm.id_remetente AS idRemetente,
    u.nome AS nomeRemetente, cm.tipo_remetente AS tipoRemetente,
    cm.mensagem, cm.lido,
    DATE_FORMAT(cm.criado_em, '%Y-%m-%dT%H:%i:%sZ') AS criadoEm
  FROM chat_mensagens cm
  JOIN usuarios u ON u.id = cm.id_remetente
`;

async function verificarAcessoPedido(idPedido: number, user: any, res: Response): Promise<boolean> {
  const [rows]: any = await db.execute("SELECT id_usuario FROM pedidos WHERE id = ? LIMIT 1", [idPedido]);
  if (!rows?.length) { res.status(404).json({ message: "Pedido não encontrado." }); return false; }
  if (user.tipo !== "admin" && rows[0].id_usuario !== user.sub) {
    res.status(403).json({ message: "Acesso negado." }); return false;
  }
  return true;
}

/** GET /pedidos/:id/mensagens/nao-lidas — contagem sem marcar lido */
pedidosRoutes.get("/:id/mensagens/nao-lidas", authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = req.jwtUser!;
  if (!(await verificarAcessoPedido(id, user, res))) return;
  const outroTipo = user.tipo === "admin" ? "cliente" : "admin";
  const [rows]: any = await db.execute(
    "SELECT COUNT(*) AS count FROM chat_mensagens WHERE id_pedido = ? AND tipo_remetente = ? AND lido = 0",
    [id, outroTipo]
  );
  return res.json({ count: Number(rows[0].count) });
});

/** GET /pedidos/:id/mensagens — lista mensagens e marca as do outro lado como lidas */
pedidosRoutes.get("/:id/mensagens", authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = req.jwtUser!;
  if (!(await verificarAcessoPedido(id, user, res))) return;

  const [rows]: any = await db.execute(`${CHAT_SEL} WHERE cm.id_pedido = ? ORDER BY cm.criado_em ASC`, [id]);

  const outroTipo = user.tipo === "admin" ? "cliente" : "admin";
  await db.execute(
    "UPDATE chat_mensagens SET lido = 1 WHERE id_pedido = ? AND tipo_remetente = ? AND lido = 0",
    [id, outroTipo]
  );

  return res.json(rows);
});

/** POST /pedidos/:id/mensagens — envia mensagem */
pedidosRoutes.post("/:id/mensagens", authMiddleware, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const user = req.jwtUser!;
  const texto = String(req.body.mensagem ?? "").trim();
  if (!texto) return res.status(400).json({ message: "Mensagem não pode ser vazia." });
  if (!(await verificarAcessoPedido(id, user, res))) return;

  const tipoRemetente = user.tipo === "admin" ? "admin" : "cliente";
  const [result]: any = await db.execute(
    "INSERT INTO chat_mensagens (id_pedido, id_remetente, tipo_remetente, mensagem) VALUES (?, ?, ?, ?)",
    [id, user.sub, tipoRemetente, texto]
  );
  const [rows]: any = await db.execute(`${CHAT_SEL} WHERE cm.id = ? LIMIT 1`, [result.insertId]);
  return res.status(201).json(rows[0]);
});

pedidosRoutes.post("/:id/checkout", authMiddleware, async (req: Request, res: Response) => {
  try {
    const pedidoId = Number(req.params.id);
    if (Number.isNaN(pedidoId)) return res.status(400).json({ message: "ID inválido." });

    // Ownership check — cliente só pode pagar o próprio pedido
    const pedido = await repo.findById(pedidoId);
    if (!pedido) return res.status(404).json({ message: "Pedido não encontrado." });

    const user = req.jwtUser!;
    if (user.tipo !== "admin" && pedido.idUsuario !== user.sub) {
      return res.status(403).json({ message: "Acesso negado." });
    }

    const result = await criarSessaoCheckout(pedidoId);
    res.json(result);
  } catch (e: any) {
    res.status(400).json({ message: e.message });
  }
});

export { pedidosRoutes };
