import { db } from "../../database/connection";
import { JobImpressaoRepository } from "./jobsImpressao.repository";

export type StatusPedidoImpressora =
  | "na_fila"
  | "reservado"
  | "aguardando_filamento"
  | "em_impressao"
  | "concluido"
  | "falhou"
  | "cancelado";

export type StatusPlanejavel = "na_fila" | "aguardando_filamento";

export interface PlanejamentoFilaInput {
  idPedido: number;
  idImpressora: number;
  posicaoFila: number;
  numeroSlotPlanejado?: number | null;
  requerTrocaManual?: boolean;
  statusInicial?: StatusPlanejavel;
  inicioPrevistoHoras?: number | null;
  conclusaoPrevistaHoras?: number | null;
  custo?: number | null;
  setupHoras?: number | null;
  riscoEsperadoHoras?: number | null;
  tempoTotalHoras?: number | null;
  atrasoHoras?: number | null;
}

export interface ReservaAlocacao {
  idAlocacao: number;
  idPedido: number;
  idImpressora: number;
  numeroSlotPlanejado: number;
}

export interface PedidoImpressoraPlanejado {
  id: number;
  idPedido: number;
  idImpressora: number;
  status: StatusPedidoImpressora;
  posicaoFila: number;
  numeroSlotPlanejado: number | null;
  requerTrocaManual: boolean;
  tentativasInicio: number;
  proximaTentativaEm: Date | null;
  inicioPrevistoHoras: number | null;
  conclusaoPrevistaHoras: number | null;
  custo: number | null;
  setupHoras: number | null;
  riscoEsperadoHoras: number | null;
  tempoTotalHoras: number | null;
  atrasoHoras: number | null;
}

export interface FiltroPlano {
  idImpressora?: number;
  idPedido?: number;
  status?: StatusPedidoImpressora | StatusPedidoImpressora[];
}

export interface ConfirmarInicioInput {
  jobRemotoId?: string | null;
  statusFisico?: string | null;
  horasConsumidas?: number;
}

export interface OpcoesFalhaAntesDoInicio {
  maxTentativas?: number;
  backoffBaseSegundos?: number;
  bloquearImpressora?: boolean;
}

export interface ResultadoFalhaAntesDoInicio {
  status: "na_fila" | "falhou";
  tentativasInicio: number;
  proximaTentativaEm: Date | null;
}

export type ResultadoCancelamentoPedido =
  | "cancelado"
  | "pedido_nao_encontrado"
  | "execucao_ativa";

export class PedidoImpressoraStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PedidoImpressoraStateError";
  }
}

const STATUS_VALIDOS = new Set<StatusPedidoImpressora>([
  "na_fila",
  "reservado",
  "aguardando_filamento",
  "em_impressao",
  "concluido",
  "falhou",
  "cancelado",
]);

const LOCK_REPLANEJAMENTO = "3d_farm_pedido_impressora_replanejamento";

function numero(value: unknown): number {
  return Number(value);
}

function numeroNullable(value: unknown): number | null {
  return value === null || value === undefined ? null : Number(value);
}

function mapearPlano(row: any): PedidoImpressoraPlanejado {
  return {
    id: numero(row.id),
    idPedido: numero(row.idPedido),
    idImpressora: numero(row.idImpressora),
    status: row.status as StatusPedidoImpressora,
    posicaoFila: numero(row.posicaoFila),
    numeroSlotPlanejado: numeroNullable(row.numeroSlotPlanejado),
    requerTrocaManual: Boolean(numero(row.requerTrocaManual)),
    tentativasInicio: numero(row.tentativasInicio),
    proximaTentativaEm: row.proximaTentativaEm ?? null,
    inicioPrevistoHoras: numeroNullable(row.inicioPrevistoHoras),
    conclusaoPrevistaHoras: numeroNullable(row.conclusaoPrevistaHoras),
    custo: numeroNullable(row.custo),
    setupHoras: numeroNullable(row.setupHoras),
    riscoEsperadoHoras: numeroNullable(row.riscoEsperadoHoras),
    tempoTotalHoras: numeroNullable(row.tempoTotalHoras),
    atrasoHoras: numeroNullable(row.atrasoHoras),
  };
}

function validarInteiroPositivo(value: number, campo: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${campo} deve ser um inteiro positivo.`);
  }
}

function inteiroLimitado(value: unknown, fallback: number, minimo: number, maximo: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(minimo, Math.min(maximo, Math.trunc(parsed)));
}

function normalizarPlanejamento(item: PlanejamentoFilaInput): Required<PlanejamentoFilaInput> {
  validarInteiroPositivo(item.idPedido, "idPedido");
  validarInteiroPositivo(item.idImpressora, "idImpressora");
  validarInteiroPositivo(item.posicaoFila, "posicaoFila");

  let numeroSlotPlanejado = item.numeroSlotPlanejado ?? null;
  let requerTrocaManual = item.requerTrocaManual ?? numeroSlotPlanejado === null;
  let statusInicial = item.statusInicial ??
    (numeroSlotPlanejado === null || requerTrocaManual ? "aguardando_filamento" : "na_fila");

  if (
    numeroSlotPlanejado !== null &&
    (!Number.isSafeInteger(numeroSlotPlanejado) || numeroSlotPlanejado < 1 || numeroSlotPlanejado > 4)
  ) {
    throw new Error("numeroSlotPlanejado deve ser nulo ou um inteiro entre 1 e 4.");
  }

  // Uma linha executável nunca pode depender de material não resolvido.
  if (numeroSlotPlanejado === null || requerTrocaManual) {
    numeroSlotPlanejado = null;
    requerTrocaManual = true;
    statusInicial = "aguardando_filamento";
  }

  return {
    ...item,
    numeroSlotPlanejado,
    requerTrocaManual,
    statusInicial,
    inicioPrevistoHoras: item.inicioPrevistoHoras ?? null,
    conclusaoPrevistaHoras: item.conclusaoPrevistaHoras ?? null,
    custo: item.custo ?? null,
    setupHoras: item.setupHoras ?? null,
    riscoEsperadoHoras: item.riscoEsperadoHoras ?? null,
    tempoTotalHoras: item.tempoTotalHoras ?? null,
    atrasoHoras: item.atrasoHoras ?? null,
  };
}

export class PedidoImpressoraRepository {
  constructor(
    private readonly jobImpressaoRepository = new JobImpressaoRepository(),
  ) {}

  async substituirPlanejamento(alocacoes: readonly PlanejamentoFilaInput[]): Promise<void> {
    const normalizadas = alocacoes.map(normalizarPlanejamento);
    const ids = new Set<number>();
    for (const alocacao of normalizadas) {
      if (ids.has(alocacao.idPedido)) {
        throw new Error(`O pedido ${alocacao.idPedido} apareceu mais de uma vez no planejamento.`);
      }
      ids.add(alocacao.idPedido);
    }

    const connection = await db.getConnection();
    let transactionStarted = false;
    let namedLockAcquired = false;
    try {
      const [lockRows]: any = await connection.execute(
        "SELECT GET_LOCK(?, 10) AS acquired",
        [LOCK_REPLANEJAMENTO],
      );
      if (numero(lockRows[0]?.acquired) !== 1) {
        throw new Error("Não foi possível obter o lock do replanejamento da fila.");
      }
      namedLockAcquired = true;

      await connection.beginTransaction();
      transactionStarted = true;

      // Conserva o histórico quando o pedido foi encerrado por outro fluxo antes
      // do replanejamento, em vez de apagar a alocação ainda planejável.
      await connection.execute(
        `UPDATE pedido_impressora pi
         INNER JOIN pedidos p ON p.id = pi.id_pedido
         SET pi.status = p.status, pi.proxima_tentativa_em = NULL
         WHERE pi.status IN ('na_fila', 'aguardando_filamento')
           AND p.status IN ('concluido', 'falhou', 'cancelado')`,
      );

      const [activeRows] = await connection.execute(
        `SELECT id, id_pedido AS idPedido, id_impressora AS idImpressora, status,
                tentativas_inicio AS tentativasInicio,
                proxima_tentativa_em AS proximaTentativaEm
         FROM pedido_impressora
         WHERE status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
         ORDER BY id
         FOR UPDATE`,
      );

      const protegidos = new Set<number>();
      const retentativas = new Map<number, { tentativas: number; proxima: Date | null }>();
      const esperasAnteriores = new Set<string>();
      for (const row of activeRows as any[]) {
        const idPedido = numero(row.idPedido);
        if (row.status === "reservado" || row.status === "em_impressao") {
          protegidos.add(idPedido);
          continue;
        }
        retentativas.set(idPedido, {
          tentativas: numero(row.tentativasInicio),
          proxima: row.proximaTentativaEm ?? null,
        });
        if (row.status === "aguardando_filamento") {
          esperasAnteriores.add(`${idPedido}:${numero(row.idImpressora)}`);
        }
      }

      const idsPedidosPlanejados = normalizadas.map((alocacao) => alocacao.idPedido);
      const pedidosAindaPendentes = new Map<number, number>();
      if (idsPedidosPlanejados.length > 0) {
        const [pedidoRows] = await connection.execute(
          `SELECT id, id_material AS idMaterial
           FROM pedidos
           WHERE status = 'na_fila'
             AND id IN (${idsPedidosPlanejados.map(() => "?").join(", ")})
           ORDER BY id
           FOR UPDATE`,
          idsPedidosPlanejados,
        );
        for (const row of pedidoRows as any[]) {
          pedidosAindaPendentes.set(numero(row.id), numero(row.idMaterial));
        }
      }

      await connection.execute(
        "DELETE FROM pedido_impressora WHERE status IN ('na_fila', 'aguardando_filamento')",
      );

      for (const alocacao of normalizadas) {
        if (protegidos.has(alocacao.idPedido) || !pedidosAindaPendentes.has(alocacao.idPedido)) {
          continue;
        }

        const retry = retentativas.get(alocacao.idPedido) ?? { tentativas: 0, proxima: null };
        await connection.execute(
          `INSERT INTO pedido_impressora (
             id_pedido, id_impressora, status, posicao_fila,
             numero_slot_planejado, requer_troca_manual,
             tentativas_inicio, proxima_tentativa_em,
             inicio_previsto_horas, conclusao_prevista_horas, custo,
             setup_horas, risco_esperado_horas, tempo_total_horas, atraso_horas
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            alocacao.idPedido,
            alocacao.idImpressora,
            alocacao.statusInicial,
            alocacao.posicaoFila,
            alocacao.numeroSlotPlanejado,
            alocacao.requerTrocaManual ? 1 : 0,
            retry.tentativas,
            retry.proxima,
            alocacao.inicioPrevistoHoras,
            alocacao.conclusaoPrevistaHoras,
            alocacao.custo,
            alocacao.setupHoras,
            alocacao.riscoEsperadoHoras,
            alocacao.tempoTotalHoras,
            alocacao.atrasoHoras,
          ],
        );

        const chaveEspera = `${alocacao.idPedido}:${alocacao.idImpressora}`;
        if (
          alocacao.statusInicial === "aguardando_filamento" &&
          !esperasAnteriores.has(chaveEspera)
        ) {
          await this.adicionarEvento(
            connection,
            alocacao.idImpressora,
            "awaiting_filament",
            `Pedido ${alocacao.idPedido} aguardando o filamento planejado.`,
            {
              pedidoId: alocacao.idPedido,
              idMaterial: pedidosAindaPendentes.get(alocacao.idPedido) ?? null,
              idImpressora: alocacao.idImpressora,
            },
          );
        }
      }

      await connection.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      if (namedLockAcquired) {
        await connection.execute("SELECT RELEASE_LOCK(?)", [LOCK_REPLANEJAMENTO]).catch(() => undefined);
      }
      connection.release();
    }
  }

  async listarPlano(filtro: FiltroPlano = {}): Promise<PedidoImpressoraPlanejado[]> {
    const where: string[] = [];
    // any[], não unknown[]: os tipos do mysql2 (ExecuteValues[]) não aceitam
    // unknown[] em db.execute — mesmo padrão usado no resto do repositório.
    const values: any[] = [];
    if (filtro.idImpressora !== undefined) {
      validarInteiroPositivo(filtro.idImpressora, "idImpressora");
      where.push("id_impressora = ?");
      values.push(filtro.idImpressora);
    }
    if (filtro.idPedido !== undefined) {
      validarInteiroPositivo(filtro.idPedido, "idPedido");
      where.push("id_pedido = ?");
      values.push(filtro.idPedido);
    }
    if (filtro.status !== undefined) {
      const statuses = Array.isArray(filtro.status) ? filtro.status : [filtro.status];
      if (statuses.length === 0 || statuses.some((status) => !STATUS_VALIDOS.has(status))) {
        throw new Error("Filtro de status de pedido_impressora inválido.");
      }
      where.push(`status IN (${statuses.map(() => "?").join(", ")})`);
      values.push(...statuses);
    }

    const [rows] = await db.execute(
      `SELECT id, id_pedido AS idPedido, id_impressora AS idImpressora,
              status, posicao_fila AS posicaoFila,
              numero_slot_planejado AS numeroSlotPlanejado,
              requer_troca_manual AS requerTrocaManual,
              tentativas_inicio AS tentativasInicio,
              proxima_tentativa_em AS proximaTentativaEm,
              inicio_previsto_horas AS inicioPrevistoHoras,
              conclusao_prevista_horas AS conclusaoPrevistaHoras,
              custo, setup_horas AS setupHoras,
              risco_esperado_horas AS riscoEsperadoHoras,
              tempo_total_horas AS tempoTotalHoras,
              atraso_horas AS atrasoHoras
       FROM pedido_impressora
       ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY id_impressora, posicao_fila, id`,
      values,
    );
    return (rows as any[]).map(mapearPlano);
  }

  async possuiPlanejamentoAtivo(): Promise<boolean> {
    const [rows] = await db.execute(
      `SELECT 1
       FROM pedido_impressora
       WHERE status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
       LIMIT 1`,
    );
    return (rows as any[]).length > 0;
  }

  async possuiPedidosPendentesSemPlano(): Promise<boolean> {
    const [rows] = await db.execute(
      `SELECT 1
       FROM pedidos p
       WHERE p.status = 'na_fila'
         AND NOT EXISTS (
           SELECT 1
           FROM pedido_impressora pi
           WHERE pi.id_pedido = p.id
             AND pi.status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
         )
       LIMIT 1`,
    );
    return (rows as any[]).length > 0;
  }

  /**
   * Invalida (remove) o planejamento ainda não executável — `na_fila` e
   * `aguardando_filamento` — que apontava para uma impressora que acabou de
   * ficar indisponível (Erro/Manutenção/Indisponível/Aguardando Remoção).
   * Não toca `reservado`/`em_impressao`: a execução ativa já é tratada pelos
   * fluxos existentes de falha (`falharExecucao`, `bloquearReservaComInicioIncerto`).
   * Os pedidos cujo plano foi removido continuam `na_fila` e voltam a
   * aparecer para `possuiPedidosPendentesSemPlano`, permitindo que o próximo
   * reescalonamento os realoque para uma impressora viável.
   */
  async invalidarPlanejamentoDaImpressora(idImpressora: number): Promise<number> {
    validarInteiroPositivo(idImpressora, "idImpressora");
    const [result]: any = await db.execute(
      `DELETE FROM pedido_impressora
       WHERE id_impressora = ? AND status IN ('na_fila', 'aguardando_filamento')`,
      [idImpressora],
    );
    return Number(result.affectedRows ?? 0);
  }

  async reservarProximaAlocacao(idImpressora?: number): Promise<ReservaAlocacao | null> {
    if (idImpressora !== undefined) validarInteiroPositivo(idImpressora, "idImpressora");
    return this.reservarComFiltro(idImpressora, undefined);
  }

  async reservarAlocacao(idImpressora: number, idPedido: number): Promise<ReservaAlocacao | null> {
    validarInteiroPositivo(idImpressora, "idImpressora");
    validarInteiroPositivo(idPedido, "idPedido");
    return this.reservarComFiltro(idImpressora, idPedido);
  }

  private async reservarComFiltro(
    idImpressora?: number,
    idPedido?: number,
  ): Promise<ReservaAlocacao | null> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const filters: string[] = [];
      const values: any[] = [];
      if (idImpressora !== undefined) {
        filters.push("pi.id_impressora = ?");
        values.push(idImpressora);
      }
      if (idPedido !== undefined) {
        filters.push("pi.id_pedido = ?");
        values.push(idPedido);
      }

      const [rows] = await connection.execute(
        `SELECT pi.id AS idAlocacao, pi.id_pedido AS idPedido,
                pi.id_impressora AS idImpressora,
                pi.numero_slot_planejado AS numeroSlotPlanejado
         FROM pedido_impressora pi
         INNER JOIN pedidos p ON p.id = pi.id_pedido
         INNER JOIN impressoras i ON i.id = pi.id_impressora
         WHERE pi.status = 'na_fila'
           AND pi.numero_slot_planejado IS NOT NULL
           AND pi.requer_troca_manual = 0
           AND (pi.proxima_tentativa_em IS NULL OR pi.proxima_tentativa_em <= NOW())
           AND p.status = 'na_fila'
           AND i.status = 'Ociosa'
           AND i.id_pedido_atual IS NULL
           ${filters.length > 0 ? `AND ${filters.join(" AND ")}` : ""}
         ORDER BY pi.id_impressora, pi.posicao_fila, pi.id
         LIMIT 1
         FOR UPDATE SKIP LOCKED`,
        values,
      );
      const row = (rows as any[])[0];
      if (!row || (idPedido !== undefined && numero(row.idPedido) !== idPedido)) {
        await connection.rollback();
        transactionStarted = false;
        return null;
      }

      const [allocationUpdate]: any = await connection.execute(
        `UPDATE pedido_impressora
         SET status = 'reservado', proxima_tentativa_em = NULL
         WHERE id = ? AND status = 'na_fila'`,
        [row.idAlocacao],
      );
      const [printerUpdate]: any = await connection.execute(
        `UPDATE impressoras
         SET status = 'Reservada', id_pedido_atual = ?, ultimo_erro = NULL
         WHERE id = ? AND status = 'Ociosa' AND id_pedido_atual IS NULL`,
        [row.idPedido, row.idImpressora],
      );
      if (numero(allocationUpdate.affectedRows) !== 1 || numero(printerUpdate.affectedRows) !== 1) {
        throw new PedidoImpressoraStateError("A alocação ou a impressora mudou durante a reserva.");
      }

      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
        "reservation",
        `Impressora reservada para o pedido ${numero(row.idPedido)} pelo planejamento da fila.`,
        { idAlocacao: numero(row.idAlocacao), numeroSlot: numero(row.numeroSlotPlanejado) },
      );
      await connection.commit();
      transactionStarted = false;
      return {
        idAlocacao: numero(row.idAlocacao),
        idPedido: numero(row.idPedido),
        idImpressora: numero(row.idImpressora),
        numeroSlotPlanejado: numero(row.numeroSlotPlanejado),
      };
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async atualizarSlotReservado(idAlocacao: number, numeroSlot: number): Promise<void> {
    validarInteiroPositivo(idAlocacao, "idAlocacao");
    if (!Number.isSafeInteger(numeroSlot) || numeroSlot < 1 || numeroSlot > 4) {
      throw new Error("numeroSlot deve ser um inteiro entre 1 e 4.");
    }

    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const row = await this.buscarAlocacaoBloqueada(connection, idAlocacao);
      if (!row) throw new PedidoImpressoraStateError("Alocação não encontrada.");
      if (row.status !== "reservado") {
        throw new PedidoImpressoraStateError("Somente uma alocação reservada pode trocar o slot planejado.");
      }
      if (
        row.statusImpressora !== "Reservada" ||
        numeroNullable(row.idPedidoAtual) !== numero(row.idPedido)
      ) {
        throw new PedidoImpressoraStateError("A reserva da impressora não corresponde à alocação.");
      }

      const [slotRows] = await connection.execute(
        `SELECT id_material AS idMaterial
         FROM impressora_slots_filamento
         WHERE id_impressora = ? AND numero_slot = ?
         FOR UPDATE`,
        [row.idImpressora, numeroSlot],
      );
      const slot = (slotRows as any[])[0];
      if (!slot || numero(slot.idMaterial) !== numero(row.idMaterialPedido)) {
        throw new PedidoImpressoraStateError("O slot informado não contém o material exigido pelo pedido.");
      }

      const [allocationUpdate]: any = await connection.execute(
        `UPDATE pedido_impressora
         SET numero_slot_planejado = ?, requer_troca_manual = 0
         WHERE id = ? AND status = 'reservado'`,
        [numeroSlot, idAlocacao],
      );
      if (numero(allocationUpdate.affectedRows) !== 1) {
        throw new PedidoImpressoraStateError("A alocação mudou durante a atualização do slot.");
      }
      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
        "planned_slot_updated",
        `Slot planejado do pedido ${numero(row.idPedido)} atualizado para ${numeroSlot}.`,
        { idAlocacao, numeroSlot },
      );
      await connection.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async marcarAguardandoFilamento(idAlocacao: number, mensagem?: string): Promise<void> {
    validarInteiroPositivo(idAlocacao, "idAlocacao");
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const row = await this.buscarAlocacaoBloqueada(connection, idAlocacao);
      if (!row) throw new PedidoImpressoraStateError("Alocação não encontrada.");
      if (row.status !== "na_fila" && row.status !== "reservado") {
        throw new PedidoImpressoraStateError("A alocação não pode aguardar filamento no estado atual.");
      }
      if (
        row.status === "reservado" &&
        (row.statusImpressora !== "Reservada" ||
          numeroNullable(row.idPedidoAtual) !== numero(row.idPedido))
      ) {
        throw new PedidoImpressoraStateError("A reserva da impressora não corresponde à alocação.");
      }

      await connection.execute(
        `UPDATE pedido_impressora
         SET status = 'aguardando_filamento', numero_slot_planejado = NULL,
             requer_troca_manual = 1, proxima_tentativa_em = NULL
         WHERE id = ?`,
        [idAlocacao],
      );
      await connection.execute(
        "UPDATE pedidos SET status = 'na_fila' WHERE id = ?",
        [row.idPedido],
      );
      if (row.status === "reservado") {
        await connection.execute(
          `UPDATE impressoras
           SET status = 'Ociosa', id_pedido_atual = NULL,
               job_remoto_id = NULL, ultimo_erro = NULL,
               tempo_para_ficar_livre_horas = 0
           WHERE id = ? AND id_pedido_atual = ?`,
          [row.idImpressora, row.idPedido],
        );
      }
      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
        "awaiting_filament",
        mensagem ?? `Pedido ${numero(row.idPedido)} aguardando o material ${numero(row.idMaterialPedido)}.`,
        { idAlocacao, pedidoId: numero(row.idPedido), idMaterial: numero(row.idMaterialPedido) },
      );
      await connection.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async marcarFalhaAntesDoInicio(
    idAlocacao: number,
    mensagem: string,
    opcoes: OpcoesFalhaAntesDoInicio = {},
  ): Promise<ResultadoFalhaAntesDoInicio> {
    validarInteiroPositivo(idAlocacao, "idAlocacao");
    const maxTentativas = inteiroLimitado(opcoes.maxTentativas, 3, 1, 255);
    const backoffBaseSegundos = inteiroLimitado(
      opcoes.backoffBaseSegundos,
      30,
      1,
      24 * 60 * 60,
    );
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const row = await this.buscarAlocacaoBloqueada(connection, idAlocacao);
      if (!row) throw new PedidoImpressoraStateError("Alocação não encontrada.");
      if (row.status !== "reservado") {
        throw new PedidoImpressoraStateError("Somente uma alocação reservada pode falhar antes do início.");
      }
      if (
        row.statusImpressora !== "Reservada" ||
        numeroNullable(row.idPedidoAtual) !== numero(row.idPedido)
      ) {
        throw new PedidoImpressoraStateError("A reserva da impressora não corresponde à alocação.");
      }

      const tentativasInicio = numero(row.tentativasInicio) + 1;
      const terminal = tentativasInicio >= maxTentativas;
      const backoffSegundos = Math.min(
        24 * 60 * 60,
        backoffBaseSegundos * 2 ** Math.max(0, tentativasInicio - 1),
      );
      const proximaTentativaEm = terminal
        ? null
        : new Date(Date.now() + backoffSegundos * 1000);

      await connection.execute(
        `UPDATE pedido_impressora
         SET status = ?, tentativas_inicio = ?, proxima_tentativa_em = ?
         WHERE id = ? AND status = 'reservado'`,
        [terminal ? "falhou" : "na_fila", tentativasInicio, proximaTentativaEm, idAlocacao],
      );
      await connection.execute(
        "UPDATE pedidos SET status = ? WHERE id = ?",
        [terminal ? "falhou" : "na_fila", row.idPedido],
      );
      await connection.execute(
        `UPDATE impressoras
         SET status = ?, id_pedido_atual = NULL, job_remoto_id = NULL,
             ultimo_erro = ?, tempo_para_ficar_livre_horas = 0, ultima_sincronizacao = NOW()
         WHERE id = ?`,
        [opcoes.bloquearImpressora ? "Erro" : "Ociosa", mensagem, row.idImpressora],
      );
      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
        terminal ? "job_start_failed_terminal" : "job_start_retry_scheduled",
        mensagem,
        {
          idAlocacao,
          pedidoId: numero(row.idPedido),
          tentativasInicio,
          proximaTentativaEm,
          impressoraBloqueada: Boolean(opcoes.bloquearImpressora),
        },
      );
      await connection.commit();
      transactionStarted = false;
      return {
        status: terminal ? "falhou" : "na_fila",
        tentativasInicio,
        proximaTentativaEm,
      };
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async bloquearReservaComInicioIncerto(
    idAlocacao: number,
    mensagem: string,
    data: Pick<ConfirmarInicioInput, "jobRemotoId"> = {},
  ): Promise<void> {
    validarInteiroPositivo(idAlocacao, "idAlocacao");
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const row = await this.buscarAlocacaoBloqueada(connection, idAlocacao);
      if (!row) throw new PedidoImpressoraStateError("Alocação não encontrada.");
      if (
        row.status !== "reservado" ||
        (row.statusImpressora !== "Reservada" && row.statusImpressora !== "Erro") ||
        numeroNullable(row.idPedidoAtual) !== numero(row.idPedido)
      ) {
        throw new PedidoImpressoraStateError(
          "A reserva não corresponde ao início físico incerto informado.",
        );
      }
      if (row.statusPedido !== "na_fila") {
        throw new PedidoImpressoraStateError(
          "O pedido deixou de estar na fila durante o início físico incerto.",
        );
      }

       const [printerUpdate]: any = await connection.execute(
         `UPDATE impressoras
         SET status = 'Erro', job_remoto_id = COALESCE(?, job_remoto_id),
             ultimo_erro = ?, ultima_sincronizacao = NOW()
          WHERE id = ? AND id_pedido_atual = ?`,
        [data.jobRemotoId ?? null, mensagem, row.idImpressora, row.idPedido],
      );
      if (
        numero(printerUpdate.affectedRows) !== 1 &&
        row.statusImpressora !== "Erro"
      ) {
        throw new PedidoImpressoraStateError(
          "A impressora mudou durante o bloqueio do início físico incerto.",
        );
      }
      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
         "job_start_state_uncertain",
         mensagem,
        {
          idAlocacao,
          pedidoId: numero(row.idPedido),
          jobRemotoId: data.jobRemotoId ?? null,
        },
      );
      await connection.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async confirmarInicio(idAlocacao: number, data: ConfirmarInicioInput = {}): Promise<void> {
    return this.confirmarInicioComEstadoImpressora(idAlocacao, data, "Reservada", "job_started");
  }

  async reconciliarInicioConfirmado(
    idAlocacao: number,
    data: ConfirmarInicioInput = {},
  ): Promise<void> {
    return this.confirmarInicioComEstadoImpressora(
      idAlocacao,
      data,
      "Erro",
      "job_start_reconciled",
    );
  }

  private async confirmarInicioComEstadoImpressora(
    idAlocacao: number,
    data: ConfirmarInicioInput,
    statusImpressoraEsperado: "Reservada" | "Erro",
    tipoEvento: "job_started" | "job_start_reconciled",
  ): Promise<void> {
    validarInteiroPositivo(idAlocacao, "idAlocacao");
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const row = await this.buscarAlocacaoBloqueada(connection, idAlocacao);
      if (!row) throw new PedidoImpressoraStateError("Alocação não encontrada.");
      if (
        row.status !== "reservado" ||
        row.statusImpressora !== statusImpressoraEsperado ||
        numeroNullable(row.idPedidoAtual) !== numero(row.idPedido)
      ) {
        throw new PedidoImpressoraStateError("A reserva não está válida para confirmar o início.");
      }

      const [allocationUpdate]: any = await connection.execute(
        `UPDATE pedido_impressora
         SET status = 'em_impressao', proxima_tentativa_em = NULL
         WHERE id = ? AND status = 'reservado'`,
        [idAlocacao],
      );
      const [orderUpdate]: any = await connection.execute(
        "UPDATE pedidos SET status = 'em_impressao' WHERE id = ? AND status = 'na_fila'",
        [row.idPedido],
      );
      // tempo_para_ficar_livre_horas passa a refletir a duração real esperada
      // do job que acabou de iniciar (tempo já ajustado por eficiência/erro
      // pelo planejamento), em vez de depender de edição manual do admin.
      // O monitor Moonraker (PrinterMonitorWorker) refina esse valor depois
      // com o tempo restante real assim que a impressora reporta progresso.
      const horasPrevistas = Number(row.tempoTotalHoras ?? data.horasConsumidas ?? 0);
      const [printerUpdate]: any = await connection.execute(
        `UPDATE impressoras
         SET status = 'Imprimindo', job_remoto_id = ?,
             status_fisico = COALESCE(?, status_fisico), ultimo_erro = NULL,
             tempo_para_ficar_livre_horas = ?,
             ultima_sincronizacao = NOW()
         WHERE id = ? AND status = ? AND id_pedido_atual = ?`,
        [
          data.jobRemotoId ?? null,
          data.statusFisico ?? null,
          Number.isFinite(horasPrevistas) && horasPrevistas > 0 ? horasPrevistas : 0,
          row.idImpressora,
          statusImpressoraEsperado,
          row.idPedido,
        ],
      );
      if (
        numero(allocationUpdate.affectedRows) !== 1 ||
        numero(orderUpdate.affectedRows) !== 1 ||
        numero(printerUpdate.affectedRows) !== 1
      ) {
        throw new PedidoImpressoraStateError("Os estados mudaram durante a confirmação do início.");
      }
      const horasConsumidas = Number(data.horasConsumidas ?? 0);
      if (Number.isFinite(horasConsumidas) && horasConsumidas > 0) {
        await connection.execute(
          `UPDATE impressoras
           SET horas_usadas_hoje = IF(
                 data_referencia_capacidade = CURDATE(),
                 horas_usadas_hoje + ?,
                 ?
               ),
               data_referencia_capacidade = CURDATE()
           WHERE id = ?`,
          [horasConsumidas, horasConsumidas, row.idImpressora],
        );
      }
      await this.adicionarEvento(
        connection,
        numero(row.idImpressora),
        tipoEvento,
        statusImpressoraEsperado === "Erro"
          ? `Início físico do pedido ${numero(row.idPedido)} reconciliado após estado incerto.`
          : `Início físico do pedido ${numero(row.idPedido)} confirmado.`,
        { idAlocacao, jobRemotoId: data.jobRemotoId ?? null },
      );
      await connection.commit();
      transactionStarted = false;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async concluirExecucao(
    idImpressora: number,
    idPedido: number,
    mensagem = "Impressão concluída. Aguardando remoção da peça da mesa.",
  ): Promise<boolean> {
    return this.finalizarExecucao(idImpressora, idPedido, "concluido", mensagem);
  }

  async falharExecucao(
    idImpressora: number,
    idPedido: number,
    mensagem: string,
  ): Promise<boolean> {
    return this.finalizarExecucao(idImpressora, idPedido, "falhou", mensagem);
  }

  private async finalizarExecucao(
    idImpressora: number,
    idPedido: number,
    destino: "concluido" | "falhou",
    mensagem: string,
  ): Promise<boolean> {
    validarInteiroPositivo(idImpressora, "idImpressora");
    validarInteiroPositivo(idPedido, "idPedido");
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [rows] = await connection.execute(
        `SELECT pi.id, pi.status, i.status AS statusImpressora,
                i.id_pedido_atual AS idPedidoAtual
         FROM pedido_impressora pi
         INNER JOIN pedidos p ON p.id = pi.id_pedido
         INNER JOIN impressoras i ON i.id = pi.id_impressora
         WHERE pi.id_impressora = ? AND pi.id_pedido = ?
           AND pi.status IN ('em_impressao', ?)
         ORDER BY pi.id DESC
         LIMIT 1
         FOR UPDATE`,
        [idImpressora, idPedido, destino],
      );
      const row = (rows as any[])[0];
      if (!row) {
        await connection.rollback();
        transactionStarted = false;
        return false;
      }
      if (row.status === destino) {
        await connection.rollback();
        transactionStarted = false;
        return false;
      }
      if (
        row.status !== "em_impressao" ||
        numeroNullable(row.idPedidoAtual) !== idPedido
      ) {
        throw new PedidoImpressoraStateError("A execução ativa não corresponde ao pedido e à impressora.");
      }

      // Fecha o job físico (jobs_impressao) desta impressora para este
      // pedido, se existir. Um pedido com quantidade > 1 gera vários jobs
      // (Fase 6); cada execução física fecha apenas o seu próprio job.
      await connection.execute(
        `UPDATE jobs_impressao
         SET status = ?, finished_at = NOW(),
             tempo_real_horas = TIMESTAMPDIFF(SECOND, started_at, NOW()) / 3600,
             erro = ?
         WHERE id_pedido = ? AND id_impressora = ? AND status = 'em_impressao'
         ORDER BY id
         LIMIT 1`,
        [destino, destino === "falhou" ? mensagem : null, idPedido, idImpressora],
      );

      // Só marca o pedido comercial como 'concluido' quando não sobrar
      // nenhuma unidade física pendente. Enquanto houver jobs 'pendente',
      // o pedido volta para 'na_fila' para que a próxima unidade seja
      // replanejada (possivelmente em outra impressora). Falha nunca
      // continua para a próxima unidade — todo o pedido falha (fail-safe).
      let statusPedidoFinal: "concluido" | "falhou" | "na_fila" = destino;
      if (destino === "concluido") {
        const [pendentesRows] = await connection.execute(
          `SELECT COUNT(*) AS pendentes FROM jobs_impressao WHERE id_pedido = ? AND status = 'pendente'`,
          [idPedido],
        );
        const pendentes = numero((pendentesRows as any[])[0]?.pendentes ?? 0);
        if (pendentes > 0) {
          statusPedidoFinal = "na_fila";
        }
      }

      const [allocationUpdate]: any = await connection.execute(
        "UPDATE pedido_impressora SET status = ? WHERE id = ? AND status = 'em_impressao'",
        [destino, row.id],
      );
      const [orderUpdate]: any = await connection.execute(
        "UPDATE pedidos SET status = ? WHERE id = ? AND status = 'em_impressao'",
        [statusPedidoFinal, idPedido],
      );
      const [printerUpdate]: any = await connection.execute(
        `UPDATE impressoras
         SET status = ?, id_pedido_atual = NULL, job_remoto_id = NULL,
             ultimo_erro = ?, tempo_para_ficar_livre_horas = 0, ultima_sincronizacao = NOW()
         WHERE id = ? AND id_pedido_atual = ?`,
        [destino === "concluido" ? "Aguardando Remoção" : "Erro", destino === "falhou" ? mensagem : null, idImpressora, idPedido],
      );
      if (
        numero(allocationUpdate.affectedRows) !== 1 ||
        numero(orderUpdate.affectedRows) !== 1 ||
        numero(printerUpdate.affectedRows) !== 1
      ) {
        throw new PedidoImpressoraStateError("Os estados mudaram durante a finalização da execução.");
      }
      await this.adicionarEvento(
        connection,
        idImpressora,
        destino === "concluido" ? "job_finished" : "job_failed",
        mensagem,
        { idAlocacao: numero(row.id), pedidoId: idPedido, statusPedidoFinal },
      );
      await connection.commit();
      transactionStarted = false;

      // Fase 13: recalcula eficiência/taxa de erro da impressora a partir
      // do histórico real de jobs, fora da transação principal (estatística
      // derivada, best-effort — nunca deve derrubar a finalização do job).
      this.atualizarEstatisticasImpressora(idImpressora).catch((err) =>
        console.error(
          `[PedidoImpressoraRepository] Falha ao recalcular estatísticas da impressora ${idImpressora}:`,
          err.message,
        ),
      );

      // `true` só quando o pedido está de fato encerrado (todas as unidades
      // concluídas, ou falha) — sinaliza ao chamador que pode notificar o
      // cliente. `false` quando ainda há unidades pendentes.
      return statusPedidoFinal === destino;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async atualizarEstatisticasImpressora(idImpressora: number): Promise<void> {
    const { eficiencia, taxaErro, amostras } =
      await this.jobImpressaoRepository.calcularEstatisticasRecentes(idImpressora);
    if (amostras === 0) return;

    const campos: string[] = [];
    const valores: any[] = [];
    if (eficiencia !== null) {
      campos.push("eficiencia = ?");
      valores.push(eficiencia);
    }
    if (taxaErro !== null) {
      campos.push("taxa_erro_recente = ?");
      valores.push(taxaErro);
    }
    if (campos.length === 0) return;

    valores.push(idImpressora);
    await db.execute(`UPDATE impressoras SET ${campos.join(", ")} WHERE id = ?`, valores);
  }

  async cancelarPlanejamentoDoPedido(idPedido: number): Promise<ResultadoCancelamentoPedido> {
    validarInteiroPositivo(idPedido, "idPedido");
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [pedidoRows] = await connection.execute(
        `SELECT id, status
         FROM pedidos
         WHERE id = ?
         FOR UPDATE`,
        [idPedido],
      );
      const pedido = (pedidoRows as any[])[0];
      if (!pedido) {
        await connection.rollback();
        transactionStarted = false;
        return "pedido_nao_encontrado";
      }

      const [rows] = await connection.execute(
        `SELECT pi.id, pi.id_impressora AS idImpressora, pi.status
         FROM pedido_impressora pi
         WHERE pi.id_pedido = ?
           AND pi.status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
         LIMIT 1
         FOR UPDATE`,
        [idPedido],
      );
      const row = (rows as any[])[0];
      if (row?.status === "reservado" || row?.status === "em_impressao") {
        await connection.rollback();
        transactionStarted = false;
        return "execucao_ativa";
      }

      if (row) {
        await connection.execute(
          "UPDATE pedido_impressora SET status = 'cancelado', proxima_tentativa_em = NULL WHERE id = ?",
          [row.id],
        );
      }
      const [pedidoUpdate]: any = await connection.execute(
        `UPDATE pedidos
         SET status = 'cancelado'
         WHERE id = ? AND status NOT IN ('em_impressao', 'concluido')`,
        [idPedido],
      );
      if (numero(pedidoUpdate.affectedRows) !== 1 && pedido.status !== "cancelado") {
        await connection.rollback();
        transactionStarted = false;
        return "execucao_ativa";
      }
      if (row) {
        await this.adicionarEvento(
          connection,
          numero(row.idImpressora),
          "queue_allocation_cancelled",
          `Planejamento do pedido ${idPedido} cancelado antes do início.`,
          { idAlocacao: numero(row.id), pedidoId: idPedido },
        );
      }
      await connection.commit();
      transactionStarted = false;
      return "cancelado";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  private async buscarAlocacaoBloqueada(connection: any, idAlocacao: number): Promise<any | null> {
    const [rows] = await connection.execute(
      `SELECT pi.id, pi.id_pedido AS idPedido, pi.id_impressora AS idImpressora,
              pi.status, pi.tentativas_inicio AS tentativasInicio,
              pi.tempo_total_horas AS tempoTotalHoras,
              p.status AS statusPedido, p.id_material AS idMaterialPedido,
              i.status AS statusImpressora, i.id_pedido_atual AS idPedidoAtual
       FROM pedido_impressora pi
       INNER JOIN pedidos p ON p.id = pi.id_pedido
       INNER JOIN impressoras i ON i.id = pi.id_impressora
       WHERE pi.id = ?
       LIMIT 1
       FOR UPDATE`,
      [idAlocacao],
    );
    return (rows as any[])[0] ?? null;
  }

  private async adicionarEvento(
    connection: any,
    idImpressora: number,
    tipo: string,
    mensagem: string,
    payload?: unknown,
  ): Promise<void> {
    await connection.execute(
      `INSERT INTO impressora_eventos (id_impressora, tipo, mensagem, payload_json)
       VALUES (?, ?, ?, ?)`,
      [idImpressora, tipo, mensagem, payload === undefined ? null : JSON.stringify(payload)],
    );
  }
}
