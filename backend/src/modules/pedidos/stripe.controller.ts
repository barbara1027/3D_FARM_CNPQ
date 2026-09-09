import { Request, Response } from "express";
import Stripe from "stripe";
import { db } from "../../database/connection";
import { ImpressoraService } from "../impressoras/impressoras.service";
import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { toNullableNumber } from "./pedidos.repository";
import { pedidoEstaProntoParaFila } from "./baseTemporal.service";
import { JobImpressaoRepository } from "../fila/jobsImpressao.repository";
import { emailClientePedidoNaFila } from "../../services/email.service";

const impressoraService = new ImpressoraService(new ImpressoraRepository());
const jobImpressaoRepository = new JobImpressaoRepository();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY não configurada no .env.");
  return new Stripe(key, { apiVersion: "2025-04-30.basil" as any });
}

export function isDuplicateKeyError(error: unknown): boolean {
  if (error === null || typeof error !== "object") return false;
  const mysqlError = error as { code?: unknown };
  return mysqlError.code === "ER_DUP_ENTRY";
}

/**
 * Registra o evento do Stripe (Fase 10) e devolve `true` somente na primeira
 * vez que este `event_id` é visto — a unicidade de `event_id` no banco é a
 * fonte da verdade da idempotência, não uma checagem em memória.
 */
export async function registrarEventoUmaVez(
  eventId: string,
  pedidoId: number,
  session: any,
): Promise<boolean> {
  try {
    await db.execute(
      `INSERT INTO pagamentos (id_pedido, provider, payment_intent_id, event_id, status, valor)
       VALUES (?, 'stripe', ?, ?, ?, ?)`,
      [
        pedidoId,
        typeof session.payment_intent === "string" ? session.payment_intent : null,
        eventId,
        String(session.payment_status ?? "paid"),
        Number(session.amount_total ?? 0) / 100,
      ],
    );
    return true;
  } catch (error) {
    if (isDuplicateKeyError(error)) return false;
    throw error;
  }
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
    } else if (!(await registrarEventoUmaVez(event.id, pedidoId, session))) {
      // event_id já processado (reentrega do Stripe) — idempotência
      // garantida pela unicidade no banco, não só por checagem de status.
      console.warn(`[STRIPE] Evento ${event.id} já processado; ignorando reentrega.`);
    } else {
      try {
        const [rows]: any = await db.execute(
          `SELECT
             p.status,
             p.quantidade,
             p.nome,
             p.tempo_gcode_horas AS tempoGcodeHoras,
             p.tempo_exec_farm_horas AS tempoExecFarmHoras,
             p.eta_horas_estimado AS etaHorasEstimado,
             p.eta_calculado_em AS etaCalculadoEm,
             p.prazo_entrega_horas AS prazoEntregaHoras,
             p.prazo_entrega AS prazoEntrega,
             p.prazo_entrega_original AS prazoEntregaOriginal,
             p.limite_inicio_impressao AS limiteInicioImpressao,
             p.tempo_maximo_espera_horas AS tempoMaximoEsperaHoras,
             p.buffer_prioridade_horas AS bufferPrioridadeHoras,
             p.buffer_seguranca_horas AS bufferSegurancaHoras,
             u.nome  AS nomeUsuario,
             u.email AS emailUsuario
           FROM pedidos p
           JOIN usuarios u ON u.id = p.id_usuario
           WHERE p.id = ? LIMIT 1`,
          [pedidoId],
        );
        const pedido = rows?.[0];

        if (!pedido) {
          console.error(`[STRIPE] Pedido ${pedidoId} não encontrado para confirmação de pagamento.`);
        } else if (pedido.status !== "aguardando_pagamento") {
          console.warn(
            `[STRIPE] Pedido ${pedidoId} não está aguardando pagamento (status atual: ` +
              `'${pedido.status}'); webhook ignorado.`,
          );
        } else if (
          !pedidoEstaProntoParaFila({
            tempoGcodeHoras: toNullableNumber(pedido.tempoGcodeHoras),
            tempoExecFarmHoras: toNullableNumber(pedido.tempoExecFarmHoras),
            etaHorasEstimado: toNullableNumber(pedido.etaHorasEstimado),
            etaCalculadoEm: pedido.etaCalculadoEm ?? null,
            prazoEntregaHoras: toNullableNumber(pedido.prazoEntregaHoras),
            prazoEntrega: pedido.prazoEntrega ?? null,
            prazoEntregaOriginal: pedido.prazoEntregaOriginal ?? null,
            limiteInicioImpressao: pedido.limiteInicioImpressao ?? null,
            tempoMaximoEsperaHoras: toNullableNumber(pedido.tempoMaximoEsperaHoras),
            bufferPrioridadeHoras: toNullableNumber(pedido.bufferPrioridadeHoras),
            bufferSegurancaHoras: toNullableNumber(pedido.bufferSegurancaHoras),
          })
        ) {
          // Pagamento confirmado, mas sem base temporal válida: mantém o
          // pedido em 'aguardando_pagamento' em vez de liberá-lo incompleto
          // para a fila. Isso não deveria acontecer (o pipeline sempre
          // calcula o ETA antes desse status), mas é a proteção final.
          console.error(
            `[STRIPE] Pedido ${pedidoId} foi pago mas não possui base temporal válida; ` +
              "mantido em 'aguardando_pagamento' para investigação.",
          );
        } else {
          const [updateResult]: any = await db.execute(
            "UPDATE pedidos SET status = 'na_fila', updated_at = NOW() WHERE id = ? AND status = 'aguardando_pagamento'",
            [pedidoId],
          );
          if (Number(updateResult.affectedRows) === 1) {
            console.log(`[STRIPE] Pedido ${pedidoId} movido para na_fila.`);
            if (pedido.emailUsuario) {
              await emailClientePedidoNaFila({
                nome: pedido.nome,
                nomeUsuario: pedido.nomeUsuario,
                emailUsuario: pedido.emailUsuario,
              }).catch((err) =>
                console.error(`[STRIPE] Falha ao enviar e-mail de pedido na fila (${pedidoId}):`, err.message),
              );
            }
            // Gera as unidades físicas de execução (Fase 6) e só então tenta
            // encaixar o pedido numa impressora ociosa.
            const quantidade = Number(pedido.quantidade) || 1;
            const tempoGcodeTotalHoras = toNullableNumber(pedido.tempoGcodeHoras);
            await jobImpressaoRepository
              .criarJobsParaPedido(
                pedidoId,
                quantidade,
                tempoGcodeTotalHoras !== null ? tempoGcodeTotalHoras / quantidade : null,
              )
              .catch((err) =>
                console.error(`[STRIPE] Falha ao criar jobs do pedido ${pedidoId}:`, err.message),
              );
            impressoraService.tentarAtribuirAutomaticamente().catch((err) =>
              console.error("[STRIPE] Falha na atribuição automática pós-pagamento:", err.message),
            );
          } else {
            console.error(
              `[STRIPE] Pedido ${pedidoId} mudou de estado durante a confirmação do pagamento.`,
            );
          }
        }
      } catch (err: any) {
        console.error(`[STRIPE] Falha ao atualizar pedido ${pedidoId}:`, err.message);
      }
    }
  }

  res.json({ received: true });
};
