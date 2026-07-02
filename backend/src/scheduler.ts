import cron from "node-cron";
import { FilaService } from "./modules/fila/fila.service";
import { PedidoRepository } from "./modules/pedidos/pedidos.repository";
import { ImpressoraRepository } from "./modules/impressoras/impressoras.repository";
import { ImpressoraService } from "./modules/impressoras/impressoras.service";

const filaService = new FilaService(new PedidoRepository(), new ImpressoraRepository());
const impressoraService = new ImpressoraService(new ImpressoraRepository());

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
}
