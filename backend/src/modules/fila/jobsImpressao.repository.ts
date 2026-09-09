import { db } from "../../database/connection";

/**
 * Unidade física de execução (Fase 6). Um pedido com `quantidade > 1` gera
 * um job por unidade; cada job passa pela fila e é impresso separadamente,
 * possivelmente em impressoras diferentes ao longo do tempo. O pedido
 * comercial só é marcado `concluido` quando todos os seus jobs terminam
 * (ver `PedidoImpressoraRepository.finalizarExecucao`).
 */
export type StatusJobImpressao =
  | "pendente"
  | "em_impressao"
  | "concluido"
  | "falhou"
  | "cancelado";

export interface JobImpressao {
  id: number;
  idPedido: number;
  indiceUnidade: number;
  status: StatusJobImpressao;
  idImpressora: number | null;
  tempoPrevistoHoras: number | null;
  tempoRealHoras: number | null;
  tentativas: number;
  erro: string | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

function toNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapJob(row: any): JobImpressao {
  return {
    id: Number(row.id),
    idPedido: Number(row.idPedido),
    indiceUnidade: Number(row.indiceUnidade),
    status: row.status as StatusJobImpressao,
    idImpressora: toNullableNumber(row.idImpressora),
    tempoPrevistoHoras: toNullableNumber(row.tempoPrevistoHoras),
    tempoRealHoras: toNullableNumber(row.tempoRealHoras),
    tentativas: Number(row.tentativas),
    erro: row.erro ?? null,
    createdAt: row.createdAt,
    startedAt: row.startedAt ?? null,
    finishedAt: row.finishedAt ?? null,
  };
}

export class JobImpressaoRepository {
  /**
   * Cria as unidades físicas de um pedido novo (uma por `quantidade`).
   * Idempotente: não duplica se o pedido já possuir algum job — protege
   * contra reentrada do pipeline (ex.: webhook do Stripe reprocessado).
   * Para abrir um novo lote (reimpressão), use `recriarJobsParaPedido`.
   */
  async criarJobsParaPedido(
    idPedido: number,
    quantidade: number,
    tempoPrevistoPorUnidadeHoras: number | null,
  ): Promise<void> {
    const [existentes] = await db.execute(
      `SELECT 1 FROM jobs_impressao WHERE id_pedido = ? LIMIT 1`,
      [idPedido],
    );
    if ((existentes as any[]).length > 0) return;
    await this.inserirLote(idPedido, quantidade, tempoPrevistoPorUnidadeHoras);
  }

  /** Reimpressão: preserva o histórico de jobs anteriores e abre um novo lote. */
  async recriarJobsParaPedido(
    idPedido: number,
    quantidade: number,
    tempoPrevistoPorUnidadeHoras: number | null,
  ): Promise<void> {
    await this.inserirLote(idPedido, quantidade, tempoPrevistoPorUnidadeHoras);
  }

  private async inserirLote(
    idPedido: number,
    quantidade: number,
    tempoPrevistoPorUnidadeHoras: number | null,
  ): Promise<void> {
    const total = Math.max(1, Math.trunc(Number(quantidade)) || 1);
    const tempo =
      Number.isFinite(tempoPrevistoPorUnidadeHoras) && (tempoPrevistoPorUnidadeHoras ?? 0) > 0
        ? tempoPrevistoPorUnidadeHoras
        : null;
    for (let indice = 1; indice <= total; indice += 1) {
      await db.execute(
        `INSERT INTO jobs_impressao (id_pedido, indice_unidade, status, tempo_previsto_horas)
         VALUES (?, ?, 'pendente', ?)`,
        [idPedido, indice, tempo],
      );
    }
  }

  /**
   * Marca a próxima unidade pendente do pedido como iniciada nesta
   * impressora. Chamado pelo orquestrador logo após o início físico ser
   * confirmado. Silencioso se não houver job pendente (pedidos antigos sem
   * jobs cadastrados continuam funcionando pelo fluxo por pedido).
   */
  async marcarProximoEmImpressao(idPedido: number, idImpressora: number): Promise<void> {
    await db.execute(
      `UPDATE jobs_impressao
       SET status = 'em_impressao', id_impressora = ?, started_at = NOW(),
           tentativas = tentativas + 1
       WHERE id_pedido = ? AND status = 'pendente'
       ORDER BY indice_unidade
       LIMIT 1`,
      [idImpressora, idPedido],
    );
  }

  async listarPorPedido(idPedido: number): Promise<JobImpressao[]> {
    const [rows] = await db.execute(
      `SELECT id, id_pedido AS idPedido, indice_unidade AS indiceUnidade, status,
              id_impressora AS idImpressora,
              tempo_previsto_horas AS tempoPrevistoHoras,
              tempo_real_horas AS tempoRealHoras,
              tentativas, erro,
              DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
              DATE_FORMAT(started_at, '%Y-%m-%d %H:%i:%s') AS startedAt,
              DATE_FORMAT(finished_at, '%Y-%m-%d %H:%i:%s') AS finishedAt
       FROM jobs_impressao
       WHERE id_pedido = ?
       ORDER BY id ASC`,
      [idPedido],
    );
    return (rows as any[]).map(mapJob);
  }

  async contarPendentes(idPedido: number): Promise<number> {
    const [rows] = await db.execute(
      `SELECT COUNT(*) AS total FROM jobs_impressao WHERE id_pedido = ? AND status = 'pendente'`,
      [idPedido],
    );
    return Number((rows as any[])[0]?.total ?? 0);
  }

  /**
   * Eficiência e taxa de erro recentes de uma impressora (Fase 13),
   * calculadas a partir do histórico real de jobs em vez de depender só de
   * valor administrativo. Considera os últimos `janela` jobs encerrados
   * (concluído ou falhou). Sem amostra suficiente, devolve `null` — quem
   * chama deve manter o valor atual (ou o default configurado) nesse caso.
   * `eficiencia` é limitada a uma faixa defensiva para não deixar uma
   * amostra ruim (ex.: tempo_real_horas quase zero) distorcer o
   * planejamento de forma absurda.
   */
  async calcularEstatisticasRecentes(
    idImpressora: number,
    janela = 50,
  ): Promise<{ eficiencia: number | null; taxaErro: number | null; amostras: number }> {
    const limite = Math.max(1, Math.min(500, Math.trunc(janela) || 50));
    const [rows] = await db.execute(
      `SELECT status, tempo_previsto_horas AS tempoPrevistoHoras, tempo_real_horas AS tempoRealHoras
       FROM (
         SELECT status, tempo_previsto_horas, tempo_real_horas, finished_at
         FROM jobs_impressao
         WHERE id_impressora = ? AND status IN ('concluido', 'falhou')
         ORDER BY finished_at DESC
         LIMIT ?
       ) recentes`,
      [idImpressora, limite],
    );
    const registros = rows as any[];
    if (registros.length === 0) {
      return { eficiencia: null, taxaErro: null, amostras: 0 };
    }

    const falhos = registros.filter((registro) => registro.status === "falhou").length;
    const taxaErro = Math.max(0, Math.min(0.95, falhos / registros.length));

    const razoes = registros
      .filter((registro) => registro.status === "concluido")
      .map((registro) => ({
        previsto: Number(registro.tempoPrevistoHoras),
        real: Number(registro.tempoRealHoras),
      }))
      .filter(
        (item) => Number.isFinite(item.previsto) && item.previsto > 0 &&
          Number.isFinite(item.real) && item.real > 0,
      )
      .map((item) => item.previsto / item.real);

    const eficiencia =
      razoes.length > 0
        ? Math.max(0.1, Math.min(3, razoes.reduce((total, r) => total + r, 0) / razoes.length))
        : null;

    return { eficiencia, taxaErro, amostras: registros.length };
  }
}
