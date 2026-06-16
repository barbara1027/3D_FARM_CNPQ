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
  idMaterial: number | null;
  idPedidoAtual: number | null;
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
}

export interface ImpressoraOtimizacaoRow {
  id: number;
  idMaterialAtual: number | null;
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
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
  idMaterial?: number | null;
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
  idMaterial?: number | null;
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
    idMaterial: mapNullableNumber(row.idMaterial),
    eficiencia: toNumber(row.eficiencia),
    taxaErroRecente: toNumber(row.taxaErroRecente),
    tempoParaFicarLivreHoras: toNumber(row.tempoParaFicarLivreHoras),
    capacidadeDiaHoras: toNumber(row.capacidadeDiaHoras),
  } as Impressora;
}

function mapImpressoraOtimizacao(row: any): ImpressoraOtimizacaoRow {
  return {
    id: toNumber(row.id),
    idMaterialAtual: mapNullableNumber(row.idMaterialAtual),
    eficiencia: toNumber(row.eficiencia),
    taxaErroRecente: toNumber(row.taxaErroRecente),
    tempoParaFicarLivreHoras: toNumber(row.tempoParaFicarLivreHoras),
    capacidadeDiaHoras: toNumber(row.capacidadeDiaHoras),
  };
}

function mapPrinterColumns() {
  return `
    SELECT
      id,
      nome,
      modelo,
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
      id_material AS idMaterial,
      id_pedido_atual AS idPedidoAtual,
      eficiencia,
      taxa_erro_recente AS taxaErroRecente,
      tempo_para_ficar_livre_horas AS tempoParaFicarLivreHoras,
      capacidade_dia_horas AS capacidadeDiaHoras
    FROM impressoras
  `;
}

export class ImpressoraRepository {
  async findAll(): Promise<Impressora[]> {
    const [rows] = await db.execute(`${mapPrinterColumns()} ORDER BY id DESC`);
    return (rows as any[]).map(mapImpressora);
  }

  async findById(id: number): Promise<Impressora | null> {
    const [rows] = await db.execute(`${mapPrinterColumns()} WHERE id = ? LIMIT 1`, [id]);
    const impressoras = (rows as any[]).map(mapImpressora);
    return impressoras[0] ?? null;
  }

  async create(data: CreateImpressoraRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO impressoras (
        nome, modelo, status, ip, base_url, api, api_key,
        timeout_ms, status_fisico, job_remoto_id, ultimo_erro,
        ultima_sincronizacao, id_material,
        eficiencia, taxa_erro_recente, tempo_para_ficar_livre_horas, capacidade_dia_horas
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.nome, data.modelo, data.status,
      data.ip ?? null, data.baseUrl ?? null, data.api, data.api_key ?? null,
      data.timeoutMs ?? 15000, data.statusFisico ?? null, data.jobRemotoId ?? null,
      data.ultimoErro ?? null, data.ultimaSincronizacao ?? null, data.idMaterial ?? null,
      data.eficiencia ?? 1, data.taxaErroRecente ?? 0,
      data.tempoParaFicarLivreHoras ?? 0, data.capacidadeDiaHoras ?? 8,
    ]);
    return result.insertId;
  }

  async update(id: number, data: UpdateImpressoraRepositoryDTO): Promise<void> {
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
    if (data.idMaterial !== undefined) { campos.push("id_material = ?"); valores.push(data.idMaterial); }
    if (data.idPedidoAtual !== undefined) { campos.push("id_pedido_atual = ?"); valores.push(data.idPedidoAtual); }
    if (data.eficiencia !== undefined) { campos.push("eficiencia = ?"); valores.push(data.eficiencia); }
    if (data.taxaErroRecente !== undefined) { campos.push("taxa_erro_recente = ?"); valores.push(data.taxaErroRecente); }
    if (data.tempoParaFicarLivreHoras !== undefined) { campos.push("tempo_para_ficar_livre_horas = ?"); valores.push(data.tempoParaFicarLivreHoras); }
    if (data.capacidadeDiaHoras !== undefined) { campos.push("capacidade_dia_horas = ?"); valores.push(data.capacidadeDiaHoras); }

    if (campos.length === 0) return;
    valores.push(id);
    await db.execute(`UPDATE impressoras SET ${campos.join(", ")} WHERE id = ?`, valores);
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM impressoras WHERE id = ?`, [id]);
  }

  async findParaOtimizacao(): Promise<ImpressoraOtimizacaoRow[]> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        id_material AS idMaterialAtual,
        eficiencia,
        taxa_erro_recente AS taxaErroRecente,
        tempo_para_ficar_livre_horas AS tempoParaFicarLivreHoras,
        capacidade_dia_horas AS capacidadeDiaHoras
      FROM impressoras
      WHERE status IN ('Ociosa', 'Imprimindo')
      ORDER BY id ASC
      `,
    );

    return (rows as any[]).map(mapImpressoraOtimizacao);
  }

  async reserveIfIdle(id: number): Promise<boolean> {
    const [result]: any = await db.execute(`
      UPDATE impressoras
      SET status = 'Reservada', ultimo_erro = NULL
      WHERE id = ? AND status = 'Ociosa'
    `, [id]);
    return result.affectedRows > 0;
  }

  async markPrinting(id: number, jobRemotoId?: string | null, statusFisico?: string | null, idPedido?: number | null): Promise<void> {
    await db.execute(`
      UPDATE impressoras
      SET status = 'Imprimindo', job_remoto_id = ?, status_fisico = ?,
          id_pedido_atual = ?, ultimo_erro = NULL, ultima_sincronizacao = NOW()
      WHERE id = ?
    `, [jobRemotoId ?? null, statusFisico ?? null, idPedido ?? null, id]);
  }

  async release(id: number, status: PrinterStatus = "Ociosa"): Promise<void> {
    await db.execute(`
      UPDATE impressoras
      SET status = ?, job_remoto_id = NULL, id_pedido_atual = NULL,
          ultimo_erro = NULL, ultima_sincronizacao = NOW()
      WHERE id = ?
    `, [status, id]);
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
      ORDER BY id DESC
      LIMIT ${parsedLimit}
    `, [idImpressora]);
    return rows as ImpressoraEvento[];
  }
}
