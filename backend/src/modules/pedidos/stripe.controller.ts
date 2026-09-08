import { Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../../database/connection";
import { ImpressoraService } from "../impressoras/impressoras.service";
import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { emailClientePedidoNaFila } from "../../services/email.service";

const impressoraService = new ImpressoraService(new ImpressoraRepository());

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada no .env.");
  return new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
}

export const stripeWebhook = async (req: Request, res: Response) => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return res.status(500).json({ message: "STRIPE_WEBHOOK_SECRET não configurado." });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = getStripe().webhooks.constructEvent(req.body, sig!, webhookSecret);
  } catch (err: any) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const pedidoIdStr = session.metadata?.pedidoId;
    const pedidoId = Number(pedidoIdStr);

    if (!pedidoIdStr || !Number.isInteger(pedidoId) || pedidoId <= 0) {
      console.error(`[STRIPE] pedidoId inválido no metadata do webhook: ${pedidoIdStr}`);
    } else {
      try {
        await db.execute(
          "UPDATE pedidos SET status = 'na_fila', updated_at = NOW() WHERE id = ?",
          [pedidoId]
        );
        console.log(`[STRIPE] Pedido ${pedidoId} movido para na_fila.`);

        const [rows]: any = await db.execute(
          `SELECT p.nome, u.nome AS nomeUsuario, u.email AS emailUsuario
           FROM pedidos p JOIN usuarios u ON u.id = p.id_usuario
           WHERE p.id = ? LIMIT 1`, [pedidoId]
        );
        if (rows?.[0]?.emailUsuario) {
          await emailClientePedidoNaFila({
            nome: rows[0].nome,
            nomeUsuario: rows[0].nomeUsuario,
            emailUsuario: rows[0].emailUsuario,
          });
        }

        // Gatilho da fila: tenta encaixar o pedido numa impressora ociosa agora mesmo.
        impressoraService.tentarAtribuirAutomaticamente().catch((err) =>
          console.error("[STRIPE] Falha na atribuição automática pós-pagamento:", err.message),
        );
      } catch (err: any) {
        console.error(`[STRIPE] Falha ao atualizar pedido ${pedidoId}:`, err.message);
      }
    }
  }

  res.json({ received: true });
};
