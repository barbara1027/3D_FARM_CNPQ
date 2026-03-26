import { db } from "../../database/connection";

export type PrinterStatus =
   "Ociosa"
   "Imprimindo"
   "Indisponivel"
   "Aguardando Remoção";

export type ApiProtocol = "OCTOPRINT" | "MOONRAKER" | "DUMMY";

export interface Impressora {
  id: number;
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip: string | null;
  api: ApiProtocol;
  api_key: string | null;
  idMaterial: number | null;
}

export interface CreateImpressoraRepositoryDTO {
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip?: string | null;
  api: ApiProtocol;
  api_key?: string | null;
  idMaterial?: number | null;
}

export interface UpdateImpressoraRepositoryDTO {
  nome?: string;
  modelo?: string;
  status?: PrinterStatus;
  ip?: string | null;
  api?: ApiProtocol;
  api_key?: string | null;
  idMaterial?: number | null;
}

export class ImpressoraRepository {
  async findAll(): Promise<Impressora[]> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        nome,
        modelo,
        status,
        ip,
        api,
        api_key,
        id_material AS idMaterial
      FROM impressoras
      ORDER BY id DESC
      `,
    );

    return rows as Impressora[];
  }

  async findById(id: number): Promise<Impressora | null> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        nome,
        modelo,
        status,
        ip,
        api,
        api_key,
        id_material AS idMaterial
      FROM impressoras
      WHERE id = ?
      LIMIT 1
      `,
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
        api,
        api_key,
        id_material
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.nome,
        data.modelo,
        data.status,
        data.ip ?? null,
        data.api,
        data.api_key ?? null,
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

    if (data.api !== undefined) {
      campos.push("api = ?");
      valores.push(data.api);
    }

    if (data.api_key !== undefined) {
      campos.push("api_key = ?");
      valores.push(data.api_key);
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
}
