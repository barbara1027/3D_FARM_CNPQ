import { db } from "../../database/connection";

export type PrinterStatus =
  | "Ociosa"
  | "Reservada"
  | "Imprimindo"
  | "Pausada"
  | "Indisponivel"
  | "Aguardando Remoção"
  | "Erro"
  | "Manutenção";

export type ApiProtocol = "OCTOPRINT" | "MOONRAKER" | "DUMMY";

export interface SlotFilamentoInput {
  numeroSlot: number;
  idMaterial: number;
}

export interface MaterialSlotImpressora {
  id: number;
  nome: string;
  tipo: string;
  cor: string;
}

export interface SlotFilamento {
  numeroSlot: number;
  material: MaterialSlotImpressora;
}

export interface Impressora {
  id: number;
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip: string | null;
  baseUrl: string | null;
  api: ApiProtocol;
  api_key: string | null;
  timeoutMs: number;
  statusFisico: string | null;
  jobRemotoId: string | null;
  ultimoErro: string | null;
  ultimaSincronizacao: string | null;
  possuiCfs: boolean;
  larguraMesaMm: number;
  profundidadeMesaMm: number;
  filamentosCarregados: SlotFilamento[];
  idPedidoAtual: number | null;
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
}

export interface ImpressoraOtimizacaoRow {
  id: number;
  idMaterialAtual: number | null;
  possuiCfs?: boolean;
  slots?: SlotFilamentoInput[];
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
  horasUsadasHoje?: number;
}

export interface CreateImpressoraRepositoryDTO {
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip?: string | null;
  baseUrl?: string | null;
  api: ApiProtocol;
  api_key?: string | null;
  timeoutMs?: number;
  statusFisico?: string | null;
  jobRemotoId?: string | null;
  ultimoErro?: string | null;
  ultimaSincronizacao?: string | null;
  possuiCfs: boolean;
  larguraMesaMm: number;
  profundidadeMesaMm: number;
  filamentosCarregados?: SlotFilamentoInput[];
  eficiencia?: number;
  taxaErroRecente?: number;
  tempoParaFicarLivreHoras?: number;
  capacidadeDiaHoras?: number;
}

export interface UpdateImpressoraRepositoryDTO {
  nome?: string;
  modelo?: string;
  status?: PrinterStatus;
  ip?: string | null;
  baseUrl?: string | null;
  api?: ApiProtocol;
  api_key?: string | null;
  timeoutMs?: number;
  statusFisico?: string | null;
  jobRemotoId?: string | null;
  ultimoErro?: string | null;
  ultimaSincronizacao?: string | null;
  possuiCfs?: boolean;
  larguraMesaMm?: number;
  profundidadeMesaMm?: number;
  idPedidoAtual?: number | null;
  eficiencia?: number;
  taxaErroRecente?: number;
  tempoParaFicarLivreHoras?: number;
  capacidadeDiaHoras?: number;
}

export interface ImpressoraEvento {
  id: number;
  idImpressora: number;
  tipo: string;
  mensagem: string;
  payloadJson: string | null;
  createdAt: string;
}

export type UpdateImpressoraResult =
  | "updated"
  | "not_found"
  | "additional_slots"
  | "printer_busy";
export type DeleteImpressoraResult = "deleted" | "not_found" | "printer_busy";
export type UpsertSlotResult =
  | "updated"
  | "printer_not_found"
  | "slot_not_allowed"
  | "printer_busy";
export type DeleteSlotResult =
  | "deleted"
  | "slot_not_found"
  | "printer_not_found"
  | "slot_not_allowed"
  | "printer_busy";

export class ImpressoraRepositoryStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImpressoraRepositoryStateError";
  }
}

function toNumber(value: unknown): number {
  return Number(value);
}

function mapNullableNumber(value: unknown): number | null {
  return value === null || value === undefined ? null : toNumber(value);
}

function mapImpressora(row: any): Impressora {
  return {
    ...row,
    id: toNumber(row.id),
    timeoutMs: toNumber(row.timeoutMs),
    possuiCfs: Boolean(toNumber(row.possuiCfs)),
    larguraMesaMm: toNumber(row.larguraMesaMm),
    profundidadeMesaMm: toNumber(row.profundidadeMesaMm),
    filamentosCarregados: [],
    idPedidoAtual: mapNullableNumber(row.idPedidoAtual),
    eficiencia: toNumber(row.eficiencia),
    taxaErroRecente: toNumber(row.taxaErroRecente),
    tempoParaFicarLivreHoras: toNumber(row.tempoParaFicarLivreHoras),
    capacidadeDiaHoras: toNumber(row.capacidadeDiaHoras),
  } as Impressora;
}

function mapSlotFilamento(row: any): SlotFilamento {
  return {
    numeroSlot: toNumber(row.numeroSlot),
    material: {
      id: toNumber(row.idMaterial),
      nome: String(row.nomeMaterial),
      tipo: String(row.tipoMaterial),
      cor: String(row.corMaterial),
    },
  };
}

function agruparSlots(impressoras: Impressora[], rows: any[]): Impressora[] {
  const porId = new Map(impressoras.map((impressora) => [impressora.id, impressora]));
  for (const row of rows) {
    porId.get(toNumber(row.idImpressora))?.filamentosCarregados.push(mapSlotFilamento(row));
  }
  for (const impressora of impressoras) {
    impressora.filamentosCarregados.sort((left, right) => left.numeroSlot - right.numeroSlot);
  }
  return impressoras;
}

function mapImpressoraOtimizacao(row: any): ImpressoraOtimizacaoRow {
  return {
    id: toNumber(row.id),
    idMaterialAtual: mapNullableNumber(row.idMaterialAtual),
    possuiCfs: Boolean(toNumber(row.possuiCfs)),
    slots: [],
    eficiencia: toNumber(row.eficiencia),
    taxaErroRecente: toNumber(row.taxaErroRecente),
    tempoParaFicarLivreHoras: toNumber(row.tempoParaFicarLivreHoras),
    capacidadeDiaHoras: toNumber(row.capacidadeDiaHoras),
    horasUsadasHoje: toNumber(row.horasUsadasHoje),
  };
}

function mapPrinterColumns() {
  return `
    SELECT
      id,
      nome,
      modelo,
      possui_cfs AS possuiCfs,
      largura_mesa_mm AS larguraMesaMm,
      profundidade_mesa_mm AS profundidadeMesaMm,
      status,
      ip,
      base_url AS baseUrl,
      api,
      api_key,
      timeout_ms AS timeoutMs,
      status_fisico AS statusFisico,
      job_remoto_id AS jobRemotoId,
      ultimo_erro AS ultimoErro,
      DATE_FORMAT(ultima_sincronizacao, '%Y-%m-%d %H:%i:%s') AS ultimaSincronizacao,
      id_pedido_atual AS idPedidoAtual,
      eficiencia,
      taxa_erro_recente AS taxaErroRecente,
      tempo_para_ficar_livre_horas AS tempoParaFicarLivreHoras,
      capacidade_dia_horas AS capacidadeDiaHoras
    FROM impressoras
  `;
}

const SLOT_COLUMNS = [
  "SELECT",
  "  sf.id_impressora AS idImpressora,",
  "  sf.numero_slot AS numeroSlot,",
  "  m.id AS idMaterial,",
  "  m.nome AS nomeMaterial,",
  "  m.tipo AS tipoMaterial,",
  "  m.cor AS corMaterial",
  "FROM impressora_slots_filamento sf",
  "INNER JOIN materiais m ON m.id = sf.id_material",
].join("\n");

export class ImpressoraRepository {
  async findAll(): Promise<Impressora[]> {
    const [rows] = await db.execute(`${mapPrinterColumns()} ORDER BY id DESC`);
    const impressoras = (rows as any[]).map(mapImpressora);
    if (impressoras.length === 0) return impressoras;

    const [slotRows] = await db.execute(
      `${SLOT_COLUMNS} ORDER BY sf.id_impressora DESC, sf.numero_slot ASC`,
    );
    return agruparSlots(impressoras, slotRows as any[]);
  }

  async findById(id: number): Promise<Impressora | null> {
    const [rows] = await db.execute(`${mapPrinterColumns()} WHERE id = ? LIMIT 1`, [id]);
    const impressoras = (rows as any[]).map(mapImpressora);
    const impressora = impressoras[0];
    if (!impressora) return null;

    const [slotRows] = await db.execute(
      `${SLOT_COLUMNS} WHERE sf.id_impressora = ? ORDER BY sf.numero_slot ASC`,
      [id],
    );
    return agruparSlots([impressora], slotRows as any[])[0];
  }

  async create(data: CreateImpressoraRepositoryDTO): Promise<number> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [result]: any = await connection.execute(`
        INSERT INTO impressoras (
          nome, modelo, possui_cfs, largura_mesa_mm, profundidade_mesa_mm,
          status, ip, base_url, api, api_key,
          timeout_ms, status_fisico, job_remoto_id, ultimo_erro,
          ultima_sincronizacao, eficiencia, taxa_erro_recente,
          tempo_para_ficar_livre_horas, capacidade_dia_horas
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        data.nome, data.modelo, data.possuiCfs ? 1 : 0,
        data.larguraMesaMm, data.profundidadeMesaMm, data.status,
        data.ip ?? null, data.baseUrl ?? null, data.api, data.api_key ?? null,
        data.timeoutMs ?? 15000, data.statusFisico ?? null, data.jobRemotoId ?? null,
        data.ultimoErro ?? null, data.ultimaSincronizacao ?? null,
        data.eficiencia ?? 1, data.taxaErroRecente ?? 0,
        data.tempoParaFicarLivreHoras ?? 0, data.capacidadeDiaHoras ?? 8,
      ]);

      const id = Number(result.insertId);
      for (const slot of data.filamentosCarregados ?? []) {
        await connection.execute(
          `INSERT INTO impressora_slots_filamento (id_impressora, numero_slot, id_material)
           VALUES (?, ?, ?)`,
          [id, slot.numeroSlot, slot.idMaterial],
        );
      }

      await connection.commit();
      transactionStarted = false;
      return id;
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async update(id: number, data: UpdateImpressoraRepositoryDTO): Promise<UpdateImpressoraResult> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.nome !== undefined) { campos.push("nome = ?"); valores.push(data.nome); }
    if (data.modelo !== undefined) { campos.push("modelo = ?"); valores.push(data.modelo); }
    if (data.status !== undefined) { campos.push("status = ?"); valores.push(data.status); }
    if (data.ip !== undefined) { campos.push("ip = ?"); valores.push(data.ip); }
    if (data.baseUrl !== undefined) { campos.push("base_url = ?"); valores.push(data.baseUrl); }
    if (data.api !== undefined) { campos.push("api = ?"); valores.push(data.api); }
    if (data.api_key !== undefined) { campos.push("api_key = ?"); valores.push(data.api_key); }
    if (data.timeoutMs !== undefined) { campos.push("timeout_ms = ?"); valores.push(data.timeoutMs); }
    if (data.statusFisico !== undefined) { campos.push("status_fisico = ?"); valores.push(data.statusFisico); }
    if (data.jobRemotoId !== undefined) { campos.push("job_remoto_id = ?"); valores.push(data.jobRemotoId); }
    if (data.ultimoErro !== undefined) { campos.push("ultimo_erro = ?"); valores.push(data.ultimoErro); }
    if (data.ultimaSincronizacao !== undefined) { campos.push("ultima_sincronizacao = ?"); valores.push(data.ultimaSincronizacao); }
    if (data.possuiCfs !== undefined) { campos.push("possui_cfs = ?"); valores.push(data.possuiCfs ? 1 : 0); }
    if (data.larguraMesaMm !== undefined) { campos.push("largura_mesa_mm = ?"); valores.push(data.larguraMesaMm); }
    if (data.profundidadeMesaMm !== undefined) { campos.push("profundidade_mesa_mm = ?"); valores.push(data.profundidadeMesaMm); }
    if (data.idPedidoAtual !== undefined) { campos.push("id_pedido_atual = ?"); valores.push(data.idPedidoAtual); }
    if (data.eficiencia !== undefined) { campos.push("eficiencia = ?"); valores.push(data.eficiencia); }
    if (data.taxaErroRecente !== undefined) { campos.push("taxa_erro_recente = ?"); valores.push(data.taxaErroRecente); }
    if (data.tempoParaFicarLivreHoras !== undefined) { campos.push("tempo_para_ficar_livre_horas = ?"); valores.push(data.tempoParaFicarLivreHoras); }
    if (data.capacidadeDiaHoras !== undefined) { campos.push("capacidade_dia_horas = ?"); valores.push(data.capacidadeDiaHoras); }

    if (campos.length === 0) return "updated";

    const sql = `UPDATE impressoras SET ${campos.join(", ")} WHERE id = ?`;
    const updateValues = [...valores, id];

    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [printerRows] = await connection.execute(
        `SELECT status, id_pedido_atual AS idPedidoAtual
         FROM impressoras
         WHERE id = ?
         FOR UPDATE`,
        [id],
      );
      const printer = (printerRows as any[])[0];
      if (!printer) {
        await connection.rollback();
        transactionStarted = false;
        return "not_found";
      }

      const alteraEstadoOuConexao =
        data.status !== undefined ||
        data.api !== undefined ||
        data.ip !== undefined ||
        data.baseUrl !== undefined ||
        data.api_key !== undefined ||
        data.timeoutMs !== undefined ||
        data.possuiCfs !== undefined ||
        data.idPedidoAtual !== undefined;
      if (
        alteraEstadoOuConexao &&
        (printer.status === "Reservada" ||
          printer.status === "Imprimindo" ||
          mapNullableNumber(printer.idPedidoAtual) !== null)
      ) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_busy";
      }

      if (data.possuiCfs === false) {
        const [slotRows] = await connection.execute(
          `SELECT numero_slot
           FROM impressora_slots_filamento
           WHERE id_impressora = ? AND numero_slot > 1
           LIMIT 1
           FOR UPDATE`,
          [id],
        );
        if ((slotRows as any[]).length > 0) {
          await connection.rollback();
          transactionStarted = false;
          return "additional_slots";
        }
      }

      const [result]: any = await connection.execute(sql, updateValues);
      if (Number(result.affectedRows) !== 1) {
        throw new Error("A impressora mudou durante a atualização.");
      }
      await connection.commit();
      transactionStarted = false;
      return "updated";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async delete(id: number): Promise<DeleteImpressoraResult> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [printerRows] = await connection.execute(
        `SELECT status, id_pedido_atual AS idPedidoAtual
         FROM impressoras
         WHERE id = ?
         FOR UPDATE`,
        [id],
      );
      const printer = (printerRows as any[])[0];
      if (!printer) {
        await connection.rollback();
        transactionStarted = false;
        return "not_found";
      }
      if (
        printer.status === "Reservada" ||
        printer.status === "Imprimindo" ||
        mapNullableNumber(printer.idPedidoAtual) !== null
      ) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_busy";
      }

      const [allocationRows] = await connection.execute(
        `SELECT id
         FROM pedido_impressora
         WHERE id_impressora = ?
           AND status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')
         LIMIT 1
         FOR UPDATE`,
        [id],
      );
      if ((allocationRows as any[]).length > 0) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_busy";
      }

      const [result]: any = await connection.execute(
        "DELETE FROM impressoras WHERE id = ?",
        [id],
      );
      if (Number(result.affectedRows) !== 1) {
        throw new Error("A impressora mudou durante a remoção.");
      }
      await connection.commit();
      transactionStarted = false;
      return "deleted";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async upsertSlot(idImpressora: number, numeroSlot: number, idMaterial: number): Promise<UpsertSlotResult> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [printerRows] = await connection.execute(
        `SELECT possui_cfs AS possuiCfs, status,
                id_pedido_atual AS idPedidoAtual
         FROM impressoras
         WHERE id = ?
         FOR UPDATE`,
        [idImpressora],
      );
      const printer = (printerRows as any[])[0];
      if (!printer) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_not_found";
      }
      if (
        printer.status === "Reservada" ||
        printer.status === "Imprimindo" ||
        mapNullableNumber(printer.idPedidoAtual) !== null
      ) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_busy";
      }
      if (!Boolean(Number(printer.possuiCfs)) && numeroSlot !== 1) {
        await connection.rollback();
        transactionStarted = false;
        return "slot_not_allowed";
      }

      await connection.execute(
        `INSERT INTO impressora_slots_filamento (id_impressora, numero_slot, id_material)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE id_material = VALUES(id_material)`,
        [idImpressora, numeroSlot, idMaterial],
      );
      await connection.commit();
      transactionStarted = false;
      return "updated";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async deleteSlot(idImpressora: number, numeroSlot: number): Promise<DeleteSlotResult> {
    const connection = await db.getConnection();
    let transactionStarted = false;
    try {
      await connection.beginTransaction();
      transactionStarted = true;
      const [printerRows] = await connection.execute(
        `SELECT possui_cfs AS possuiCfs, status,
                id_pedido_atual AS idPedidoAtual
         FROM impressoras
         WHERE id = ?
         FOR UPDATE`,
        [idImpressora],
      );
      const printer = (printerRows as any[])[0];
      if (!printer) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_not_found";
      }
      if (
        printer.status === "Reservada" ||
        printer.status === "Imprimindo" ||
        mapNullableNumber(printer.idPedidoAtual) !== null
      ) {
        await connection.rollback();
        transactionStarted = false;
        return "printer_busy";
      }
      if (!Boolean(Number(printer.possuiCfs)) && numeroSlot !== 1) {
        await connection.rollback();
        transactionStarted = false;
        return "slot_not_allowed";
      }

      const [result]: any = await connection.execute(
        "DELETE FROM impressora_slots_filamento WHERE id_impressora = ? AND numero_slot = ?",
        [idImpressora, numeroSlot],
      );
      await connection.commit();
      transactionStarted = false;
      return Number(result.affectedRows) > 0 ? "deleted" : "slot_not_found";
    } catch (error) {
      if (transactionStarted) await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async findParaOtimizacao(): Promise<ImpressoraOtimizacaoRow[]> {
    const [rows] = await db.execute(
      `
      SELECT
        i.id,
        slot1.id_material AS idMaterialAtual,
        i.possui_cfs AS possuiCfs,
        i.eficiencia,
        i.taxa_erro_recente AS taxaErroRecente,
        i.tempo_para_ficar_livre_horas AS tempoParaFicarLivreHoras,
        i.capacidade_dia_horas AS capacidadeDiaHoras,
        CASE
          WHEN i.data_referencia_capacidade = CURDATE() THEN i.horas_usadas_hoje
          ELSE 0
        END AS horasUsadasHoje
      FROM impressoras i
      LEFT JOIN impressora_slots_filamento slot1
        ON slot1.id_impressora = i.id AND slot1.numero_slot = 1
      WHERE i.status IN ('Ociosa', 'Imprimindo')
      ORDER BY i.id ASC
      `,
    );
    const impressoras = (rows as any[]).map(mapImpressoraOtimizacao);
    if (impressoras.length === 0) return impressoras;

    const [slotRows] = await db.execute(
      `SELECT sf.id_impressora AS idImpressora,
              sf.numero_slot AS numeroSlot,
              sf.id_material AS idMaterial
       FROM impressora_slots_filamento sf
       INNER JOIN impressoras i ON i.id = sf.id_impressora
       WHERE i.status IN ('Ociosa', 'Imprimindo')
       ORDER BY sf.id_impressora, sf.numero_slot`,
    );
    const porId = new Map(impressoras.map((impressora) => [impressora.id, impressora]));
    for (const row of slotRows as any[]) {
      const impressora = porId.get(toNumber(row.idImpressora));
      if (!impressora) continue;
      (impressora.slots ??= []).push({
        numeroSlot: toNumber(row.numeroSlot),
        idMaterial: toNumber(row.idMaterial),
      });
    }
    return impressoras;
  }

  async release(id: number, status: PrinterStatus = "Ociosa"): Promise<void> {
    const [result]: any = await db.execute(`
      UPDATE impressoras
      SET status = ?, job_remoto_id = NULL, id_pedido_atual = NULL,
          ultimo_erro = NULL, ultima_sincronizacao = NOW()
      WHERE id = ? AND status = 'Aguardando Remoção' AND id_pedido_atual IS NULL
    `, [status, id]);
    if (Number(result.affectedRows) !== 1) {
      throw new ImpressoraRepositoryStateError(
        "A impressora deixou de aguardar remoção antes de ser liberada.",
      );
    }
  }

  async markError(id: number, mensagem: string, statusFisico?: string | null): Promise<void> {
    await db.execute(`
      UPDATE impressoras
      SET status = 'Erro', status_fisico = ?, ultimo_erro = ?, ultima_sincronizacao = NOW()
      WHERE id = ?
    `, [statusFisico ?? null, mensagem, id]);
  }

  async addEvent(idImpressora: number, tipo: string, mensagem: string, payload?: unknown): Promise<void> {
    await db.execute(`
      INSERT INTO impressora_eventos (id_impressora, tipo, mensagem, payload_json)
      VALUES (?, ?, ?, ?)
    `, [idImpressora, tipo, mensagem, payload ? JSON.stringify(payload) : null]);
  }

  async listEvents(idImpressora: number, limit = 20): Promise<ImpressoraEvento[]> {
    const parsedLimit = Math.max(1, Math.min(limit, 100));
    const [rows] = await db.execute(`
      SELECT
        id,
        id_impressora AS idImpressora,
        tipo,
        mensagem,
        payload_json AS payloadJson,
        DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt
      FROM impressora_eventos
      WHERE id_impressora = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ?
    `, [idImpressora, parsedLimit]);
    return rows as ImpressoraEvento[];
  }
}
