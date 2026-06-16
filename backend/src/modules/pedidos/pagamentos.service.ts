import Stripe from 'stripe';
import { PedidoRepository } from './pedidos.repository';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-04-30.basil' as any });

export async function criarSessaoCheckout(pedidoId: number) {
  const repo = new PedidoRepository();
  const pedido = await repo.findById(pedidoId);

  if (!pedido || pedido.status !== 'aguardando_pagamento') {
    throw new Error("Pedido não disponível para pagamento.");
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'brl',
        product_data: { name: `Impressão 3D: ${pedido.nome}`, description: pedido.nomeMaterial ?? '' },
        unit_amount: Math.round(pedido.preco * 100), // Stripe usa centavos
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.FRONTEND_URL}/dashboard?pagamento=sucesso`,
    cancel_url: `${process.env.FRONTEND_URL}/quotes?pagamento=cancelado`,
    metadata: { pedidoId: pedido.id.toString() },
  });

  return { checkoutUrl: session.url };
}