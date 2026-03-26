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
}

export interface ImpressoraEvento {
  id: number;
  idImpressora: number;
  tipo: string;
  mensagem: string;
  payloadJson: string | null;
  createdAt: string;
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
      id_material AS idMaterial
    FROM impressoras
  `;
}

export class ImpressoraRepository {
  async findAll(): Promise<Impressora[]> {
    const [rows] = await db.execute(
      `${mapPrinterColumns()} ORDER BY id DESC`,
    );

    return rows as Impressora[];
  }

  async findById(id: number): Promise<Impressora | null> {
    const [rows] = await db.execute(
      `${mapPrinterColumns()} WHERE id = ? LIMIT 1`,
      [id],
    );

    const impressoras = rows as Impressora[];
    return impressoras[0] ?? null;
  }

  async create(data: CreateImpressoraRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `
      INSERT INTO impressoras (
        nome,
        modelo,
        status,
        ip,
        base_url,
        api,
        api_key,
        timeout_ms,
        status_fisico,
        job_remoto_id,
        ultimo_erro,
        ultima_sincronizacao,
        id_material
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.modelo,
        data.status,
        data.ip ?? null,
        data.baseUrl ?? null,
        data.api,
        data.api_key ?? null,
        data.timeoutMs ?? 15000,
        data.statusFisico ?? null,
        data.jobRemotoId ?? null,
        data.ultimoErro ?? null,
        data.ultimaSincronizacao ?? null,
        data.idMaterial ?? null,
      ],
    );

    return result.insertId;
  }

  async update(id: number, data: UpdateImpressoraRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: unknown[] = [];

    if (data.nome !== undefined) {
      campos.push("nome = ?");
      valores.push(data.nome);
    }
    if (data.modelo !== undefined) {
      campos.push("modelo = ?");
      valores.push(data.modelo);
    }
    if (data.status !== undefined) {
      campos.push("status = ?");
      valores.push(data.status);
    }
    if (data.ip !== undefined) {
      campos.push("ip = ?");
      valores.push(data.ip);
    }
    if (data.baseUrl !== undefined) {
      campos.push("base_url = ?");
      valores.push(data.baseUrl);
    }
    if (data.api !== undefined) {
      campos.push("api = ?");
      valores.push(data.api);
    }
    if (data.api_key !== undefined) {
      campos.push("api_key = ?");
      valores.push(data.api_key);
    }
    if (data.timeoutMs !== undefined) {
      campos.push("timeout_ms = ?");
      valores.push(data.timeoutMs);
    }
    if (data.statusFisico !== undefined) {
      campos.push("status_fisico = ?");
      valores.push(data.statusFisico);
    }
    if (data.jobRemotoId !== undefined) {
      campos.push("job_remoto_id = ?");
      valores.push(data.jobRemotoId);
    }
    if (data.ultimoErro !== undefined) {
      campos.push("ultimo_erro = ?");
      valores.push(data.ultimoErro);
    }
    if (data.ultimaSincronizacao !== undefined) {
      campos.push("ultima_sincronizacao = ?");
      valores.push(data.ultimaSincronizacao);
    }
    if (data.idMaterial !== undefined) {
      campos.push("id_material = ?");
      valores.push(data.idMaterial);
    }

    if (campos.length === 0) {
      return;
    }

    valores.push(id);

    await db.execute(
      `
      UPDATE impressoras
      SET ${campos.join(", ")}
      WHERE id = ?
      `,
      valores,
    );
  }

  async delete(id: number): Promise<void> {
    await db.execute(
      `
      DELETE FROM impressoras
      WHERE id = ?
      `,
      [id],
    );
  }

  async reserveIfIdle(id: number): Promise<boolean> {
    const [result]: any = await db.execute(
      `
      UPDATE impressoras
      SET status = 'Reservada', ultimo_erro = NULL
      WHERE id = ? AND status = 'Ociosa'
      `,
      [id],
    );

    return result.affectedRows > 0;
  }

  async markPrinting(id: number, jobRemotoId?: string | null, statusFisico?: string | null): Promise<void> {
    await db.execute(
      `
      UPDATE impressoras
      SET
        status = 'Imprimindo',
        job_remoto_id = ?,
        status_fisico = ?,
        ultimo_erro = NULL,
        ultima_sincronizacao = NOW()
      WHERE id = ?
      `,
      [jobRemotoId ?? null, statusFisico ?? null, id],
    );
  }

  async release(id: number, status: PrinterStatus = 'Ociosa'): Promise<void> {
    await db.execute(
      `
      UPDATE impressoras
      SET
        status = ?,
        job_remoto_id = NULL,
        ultimo_erro = NULL,
        ultima_sincronizacao = NOW()
      WHERE id = ?
      `,
      [status, id],
    );
  }

  async markError(id: number, mensagem: string, statusFisico?: string | null): Promise<void> {
    await db.execute(
      `
      UPDATE impressoras
      SET
        status = 'Erro',
        status_fisico = ?,
        ultimo_erro = ?,
        ultima_sincronizacao = NOW()
      WHERE id = ?
      `,
      [statusFisico ?? null, mensagem, id],
    );
  }

  async addEvent(
    idImpressora: number,
    tipo: string,
    mensagem: string,
    payload?: unknown,
  ): Promise<void> {
    await db.execute(
      `
      INSERT INTO impressora_eventos (
        id_impressora,
        tipo,
        mensagem,
        payload_json
      )
      VALUES (?, ?, ?, ?)
      `,
      [idImpressora, tipo, mensagem, payload ? JSON.stringify(payload) : null],
    );
  }

  async listEvents(idImpressora: number, limit = 20): Promise<ImpressoraEvento[]> {
    const parsedLimit = Math.max(1, Math.min(limit, 100));

    const [rows] = await db.execute(
      `
      SELECT
        id,
        id_impressora AS idImpressora,
        tipo,
        mensagem,
        payload_json AS payloadJson,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') AS createdAt
      FROM impressora_eventos
      WHERE id_impressora = ?
      ORDER BY id DESC
      LIMIT ${parsedLimit}
      `,
      [idImpressora],
    );

    return rows as ImpressoraEvento[];
  }
}
