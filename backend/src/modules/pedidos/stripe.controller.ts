import { Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../../database/connection";

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
      } catch (err: any) {
        console.error(`[STRIPE] Falha ao atualizar pedido ${pedidoId}:`, err.message);
      }
    }
  }

  res.json({ received: true });
};
