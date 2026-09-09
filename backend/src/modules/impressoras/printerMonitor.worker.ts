import { ImpressoraRepository } from "./impressoras.repository";
import { ImpressoraService } from "./impressoras.service";

const INTERVALO_PADRAO_MS = 20_000;

function getIntervaloMs(): number {
  const valor = Number(process.env.PRINTER_MONITOR_INTERVALO_MS ?? INTERVALO_PADRAO_MS);
  return Number.isFinite(valor) && valor >= 5_000 ? valor : INTERVALO_PADRAO_MS;
}

/**
 * Monitor automático das impressoras Moonraker: periodicamente consulta o
 * status físico de cada impressora `Imprimindo` e deixa o orquestrador
 * (`ImpressoraOrquestradorService.sincronizarStatusSilencioso`) aplicar os
 * efeitos já existentes — conclusão automática (`concluirExecucao`), falha
 * automática (`falharExecucao`, que também dispara `reagirAImpressoraIndisponivel`)
 * e atualização de `tempo_para_ficar_livre_horas` a partir do tempo restante
 * reportado. Não inventa nenhum efeito novo: só passa a chamar, de forma
 * independente do frontend, o que antes só acontecia quando um admin clicava
 * em "sincronizar".
 *
 * Intervalo configurável via `PRINTER_MONITOR_INTERVALO_MS` (padrão 20s,
 * mínimo 5s para evitar polling agressivo).
 */
export class PrinterMonitorWorker {
  private timer: NodeJS.Timeout | null = null;
  private executando = false;

  constructor(
    private readonly impressoraRepository: ImpressoraRepository,
    private readonly impressoraService: ImpressoraService,
  ) {}

  async executarCiclo(): Promise<void> {
    if (this.executando) return;
    this.executando = true;
    try {
      const impressoras = await this.impressoraRepository.findAll();
      const ativas = impressoras.filter(
        (impressora) => impressora.api === "MOONRAKER" && impressora.status === "Imprimindo",
      );

      for (const impressora of ativas) {
        try {
          await this.impressoraService.monitorarStatusSilencioso(impressora.id);
        } catch (error: any) {
          console.error(
            `[PrinterMonitorWorker] Falha ao monitorar impressora ${impressora.id}:`,
            error?.message ?? error,
          );
        }
      }
    } catch (error: any) {
      console.error("[PrinterMonitorWorker] Falha ao listar impressoras:", error?.message ?? error);
    } finally {
      this.executando = false;
    }
  }

  iniciar(): void {
    if (this.timer) return;
    const intervaloMs = getIntervaloMs();
    this.timer = setInterval(() => {
      this.executarCiclo().catch((error) =>
        console.error("[PrinterMonitorWorker] Erro inesperado no ciclo:", error),
      );
    }, intervaloMs);
    console.log(`[PrinterMonitorWorker] Monitor Moonraker iniciado (intervalo ${intervaloMs / 1000}s).`);
  }

  parar(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
