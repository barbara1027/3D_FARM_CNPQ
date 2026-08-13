import cron from "node-cron";
import { FilaService } from "./modules/fila/fila.service";
import { PedidoRepository } from "./modules/pedidos/pedidos.repository";
import { ImpressoraRepository } from "./modules/impressoras/impressoras.repository";
import { ImpressoraService } from "./modules/impressoras/impressoras.service";

const impressoraRepository = new ImpressoraRepository();
const filaService = new FilaService(new PedidoRepository(), impressoraRepository);
const impressoraService = new ImpressoraService(
  impressoraRepository,
  undefined,
  filaService,
);

export async function reescalonarFila(): Promise<void> {
  try {
    await filaService.reescalonarFilaVirtual();
  } catch (e) {
    console.error("[Scheduler] Erro no reescalonamento:", e);
  }
  // Varredura de segurança: encaixa pedidos que ficaram na_fila sem serem
  // pegos pelos gatilhos de evento (pagamento confirmado / impressora liberada).
  try {
    await impressoraService.tentarAtribuirAutomaticamente();
  } catch (e) {
    console.error("[Scheduler] Erro na atribuição automática:", e);
  }
}

const INTERVALO_ATRIBUICAO_MS = 30_000;
let atribuicaoEmAndamento = false;

/**
 * Rede de segurança de curto prazo: a cada 30s, tenta encaixar pedidos
 * na_fila em impressoras ociosas. Cobre pedidos novos e mudanças de estado
 * (impressora liberada) que por algum motivo não dispararam a tentativa via
 * evento (webhook do Stripe, confirmação de remoção) — sem depender só do
 * cron diário.
 */
function iniciarAtribuicaoPeriodica(): void {
  setInterval(async () => {
    if (atribuicaoEmAndamento) return;
    atribuicaoEmAndamento = true;
    try {
      const atribuicoes = await impressoraService.tentarAtribuirAutomaticamente();
      if (atribuicoes.length > 0) {
        console.log(`[Scheduler] Atribuição periódica: ${atribuicoes.length} pedido(s) atribuído(s).`);
      }
    } catch (e: any) {
      console.error("[Scheduler] Erro na atribuição periódica:", e.message);
    } finally {
      atribuicaoEmAndamento = false;
    }
  }, INTERVALO_ATRIBUICAO_MS);

  console.log(`[Scheduler] Atribuição automática periódica a cada ${INTERVALO_ATRIBUICAO_MS / 1000}s.`);
}

export function startSchedulers(): void {
  const envExpr = process.env.CRON_REESCALONAMENTO ?? "0 6 * * *";
  const expr = cron.validate(envExpr) ? envExpr : "0 6 * * *";

  if (expr !== envExpr) {
    console.warn(
      `[Scheduler] CRON_REESCALONAMENTO inválido: "${envExpr}". Usando padrão "0 6 * * *".`,
    );
  }

  cron.schedule(expr, () => {
    console.log("[Scheduler] Reescalonamento diário da fila iniciado.");
    reescalonarFila();
  });

  console.log(`[Scheduler] Reescalonamento diário agendado: ${expr}`);

  iniciarAtribuicaoPeriodica();
}
