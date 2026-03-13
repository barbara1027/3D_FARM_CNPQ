import { db } from "../../database/connection";

export interface QualidadeImpressao {
  id: number;
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
}

export interface CreateQualidadeImpressaoRepositoryDTO {
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
}

export interface UpdateQualidadeImpressaoRepositoryDTO {
  altura?: number;
  espessura?: number;
  preenchimento?: number;
  velocidade?: number;
  temperaturaBico?: number;
  temperaturaMesa?: number;
  suporte?: number;
  adesao?: number;
}

export class QualidadeImpressaoRepository {
  async findAll(): Promise<QualidadeImpressao[]> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperatura_bico AS temperaturaBico,
        temperatura_mesa AS temperaturaMesa,
        suporte,
        adesao
      FROM qualidades
      ORDER BY id DESC
      `
    );

    return rows as QualidadeImpressao[];
  }

  async findById(id: number): Promise<QualidadeImpressao | null> {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperatura_bico AS temperaturaBico,
        temperatura_mesa AS temperaturaMesa,
        suporte,
        adesao
      FROM qualidades
      WHERE id = ?
      LIMIT 1
      `,
      [id]
    );

    const qualidades = rows as QualidadeImpressao[];
    return qualidades[0] ?? null;
  }

  async create(data: CreateQualidadeImpressaoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(
      `
      INSERT INTO qualidades (
        altura,
        espessura,
        preenchimento,
        velocidade,
        temperatura_bico,
        temperatura_mesa,
        suporte,
        adesao
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        data.altura,
        data.espessura,
        data.preenchimento,
        data.velocidade,
        data.temperaturaBico,
        data.temperaturaMesa,
        data.suporte,
        data.adesao,
      ]
    );

    return result.insertId;
  }

  async update(
    id: number,
    data: UpdateQualidadeImpressaoRepositoryDTO
  ): Promise<void> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.altura !== undefined) {
      campos.push("altura = ?");
      valores.push(data.altura);
    }

    if (data.espessura !== undefined) {
      campos.push("espessura = ?");
      valores.push(data.espessura);
    }

    if (data.preenchimento !== undefined) {
      campos.push("preenchimento = ?");
      valores.push(data.preenchimento);
    }

    if (data.velocidade !== undefined) {
      campos.push("velocidade = ?");
      valores.push(data.velocidade);
    }

    if (data.temperaturaBico !== undefined) {
      campos.push("temperatura_bico = ?");
      valores.push(data.temperaturaBico);
    }

    if (data.temperaturaMesa !== undefined) {
      campos.push("temperatura_mesa = ?");
      valores.push(data.temperaturaMesa);
    }

    if (data.suporte !== undefined) {
      campos.push("suporte = ?");
      valores.push(data.suporte);
    }

    if (data.adesao !== undefined) {
      campos.push("adesao = ?");
      valores.push(data.adesao);
    }

    if (campos.length === 0) {
      return;
    }

    valores.push(id);

    await db.execute(
      `
      UPDATE qualidades
      SET ${campos.join(", ")}
      WHERE id = ?
      `,
      valores
    );
  }

  async delete(id: number): Promise<void> {
    await db.execute(
      `
      DELETE FROM qualidades
      WHERE id = ?
      `,
      [id]
    );
  }
}