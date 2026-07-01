import { db } from "../../database/connection";

export type MaterialStatus = "disponivel" | "indisponivel";

export interface Material {
  id: number;
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
  diametro: number;
  tempBicoMin: number | null;
  tempBicoMax: number | null;
  tempBicoRecomendada: number | null;
  tempMesaMin: number | null;
  tempMesaMax: number | null;
  tempMesaRecomendada: number | null;
  fanMin: number | null;
  fanMax: number | null;
  camadaMin: number | null;
  camadaMax: number | null;
}

export interface CreateMaterialRepositoryDTO {
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
  diametro?: number;
  tempBicoMin?: number | null;
  tempBicoMax?: number | null;
  tempBicoRecomendada?: number | null;
  tempMesaMin?: number | null;
  tempMesaMax?: number | null;
  tempMesaRecomendada?: number | null;
  fanMin?: number | null;
  fanMax?: number | null;
  camadaMin?: number | null;
  camadaMax?: number | null;
}

export interface UpdateMaterialRepositoryDTO {
  nome?: string;
  tipo?: string;
  preco?: number;
  status?: MaterialStatus;
  cor?: string;
  diametro?: number;
  tempBicoMin?: number | null;
  tempBicoMax?: number | null;
  tempBicoRecomendada?: number | null;
  tempMesaMin?: number | null;
  tempMesaMax?: number | null;
  tempMesaRecomendada?: number | null;
  fanMin?: number | null;
  fanMax?: number | null;
  camadaMin?: number | null;
  camadaMax?: number | null;
}

const SEL = `
  SELECT
    id, nome, tipo, preco, status, cor,
    diametro,
    temp_bico_min         AS tempBicoMin,
    temp_bico_max         AS tempBicoMax,
    temp_bico_recomendada AS tempBicoRecomendada,
    temp_mesa_min         AS tempMesaMin,
    temp_mesa_max         AS tempMesaMax,
    temp_mesa_recomendada AS tempMesaRecomendada,
    fan_min    AS fanMin,
    fan_max    AS fanMax,
    camada_min AS camadaMin,
    camada_max AS camadaMax,
    created_at, updated_at
  FROM materiais
`;

export class MaterialRepository {
  async findAll(): Promise<Material[]> {
    const [rows] = await db.execute(`${SEL} ORDER BY id DESC`);
    return rows as Material[];
  }

  async findById(id: number): Promise<Material | null> {
    const [rows] = await db.execute(`${SEL} WHERE id = ? LIMIT 1`, [id]);
    const list = rows as Material[];
    return list[0] ?? null;
  }

  async create(data: CreateMaterialRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO materiais
        (nome, tipo, preco, status, cor, diametro,
         temp_bico_min, temp_bico_max, temp_bico_recomendada,
         temp_mesa_min, temp_mesa_max, temp_mesa_recomendada,
         fan_min, fan_max, camada_min, camada_max)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.nome, data.tipo, data.preco, data.status, data.cor,
      data.diametro ?? 1.75,
      data.tempBicoMin ?? null, data.tempBicoMax ?? null, data.tempBicoRecomendada ?? null,
      data.tempMesaMin ?? null, data.tempMesaMax ?? null, data.tempMesaRecomendada ?? null,
      data.fanMin ?? null, data.fanMax ?? null,
      data.camadaMin ?? null, data.camadaMax ?? null,
    ]);
    return result.insertId;
  }

  async update(id: number, data: UpdateMaterialRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.nome      !== undefined) { campos.push("nome = ?");       valores.push(data.nome); }
    if (data.tipo      !== undefined) { campos.push("tipo = ?");       valores.push(data.tipo); }
    if (data.preco     !== undefined) { campos.push("preco = ?");      valores.push(data.preco); }
    if (data.status    !== undefined) { campos.push("status = ?");     valores.push(data.status); }
    if (data.cor       !== undefined) { campos.push("cor = ?");        valores.push(data.cor); }
    if (data.diametro  !== undefined) { campos.push("diametro = ?");   valores.push(data.diametro); }
    if (data.tempBicoMin       !== undefined) { campos.push("temp_bico_min = ?");         valores.push(data.tempBicoMin); }
    if (data.tempBicoMax       !== undefined) { campos.push("temp_bico_max = ?");         valores.push(data.tempBicoMax); }
    if (data.tempBicoRecomendada !== undefined) { campos.push("temp_bico_recomendada = ?"); valores.push(data.tempBicoRecomendada); }
    if (data.tempMesaMin       !== undefined) { campos.push("temp_mesa_min = ?");         valores.push(data.tempMesaMin); }
    if (data.tempMesaMax       !== undefined) { campos.push("temp_mesa_max = ?");         valores.push(data.tempMesaMax); }
    if (data.tempMesaRecomendada !== undefined) { campos.push("temp_mesa_recomendada = ?"); valores.push(data.tempMesaRecomendada); }
    if (data.fanMin    !== undefined) { campos.push("fan_min = ?");    valores.push(data.fanMin); }
    if (data.fanMax    !== undefined) { campos.push("fan_max = ?");    valores.push(data.fanMax); }
    if (data.camadaMin !== undefined) { campos.push("camada_min = ?"); valores.push(data.camadaMin); }
    if (data.camadaMax !== undefined) { campos.push("camada_max = ?"); valores.push(data.camadaMax); }

    if (campos.length === 0) return;
    valores.push(id);
    await db.execute(`UPDATE materiais SET ${campos.join(", ")} WHERE id = ?`, valores);
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM materiais WHERE id = ?`, [id]);
  }
}
