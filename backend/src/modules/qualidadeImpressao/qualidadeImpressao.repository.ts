import { db } from "../../database/connection";

export interface QualidadeImpressao {
  id: number;
  nome: string;
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
  perimetros: number;
  camadasTopo: number;
  camadasBase: number;
  anguloSuporte: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQualidadeImpressaoRepositoryDTO {
  nome?: string;
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
  perimetros?: number;
  camadasTopo?: number;
  camadasBase?: number;
  anguloSuporte?: number;
}

export interface UpdateQualidadeImpressaoRepositoryDTO {
  nome?: string;
  altura?: number;
  espessura?: number;
  preenchimento?: number;
  velocidade?: number;
  temperaturaBico?: number;
  temperaturaMesa?: number;
  suporte?: number;
  adesao?: number;
  perimetros?: number;
  camadasTopo?: number;
  camadasBase?: number;
  anguloSuporte?: number;
}

const SELECT_Q = `
  SELECT
    id, nome, altura, espessura, preenchimento, velocidade,
    temperatura_bico AS temperaturaBico,
    temperatura_mesa AS temperaturaMesa,
    suporte, adesao,
    perimetros,
    camadas_topo  AS camadasTopo,
    camadas_base  AS camadasBase,
    angulo_suporte AS anguloSuporte,
    DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS createdAt,
    DATE_FORMAT(updated_at, '%Y-%m-%dT%H:%i:%sZ') AS updatedAt
  FROM qualidades
`;

export class QualidadeImpressaoRepository {
  async findAll(): Promise<QualidadeImpressao[]> {
    const [rows] = await db.execute(`${SELECT_Q} ORDER BY id ASC`);
    return rows as QualidadeImpressao[];
  }

  async findById(id: number): Promise<QualidadeImpressao | null> {
    const [rows] = await db.execute(`${SELECT_Q} WHERE id = ? LIMIT 1`, [id]);
    const list = rows as QualidadeImpressao[];
    return list[0] ?? null;
  }

  async create(data: CreateQualidadeImpressaoRepositoryDTO): Promise<number> {
    const [result]: any = await db.execute(`
      INSERT INTO qualidades
        (nome, altura, espessura, preenchimento, velocidade,
         temperatura_bico, temperatura_mesa, suporte, adesao,
         perimetros, camadas_topo, camadas_base, angulo_suporte)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      data.nome ?? "",
      data.altura, data.espessura, data.preenchimento, data.velocidade,
      data.temperaturaBico, data.temperaturaMesa, data.suporte, data.adesao,
      data.perimetros ?? 2, data.camadasTopo ?? 3, data.camadasBase ?? 3, data.anguloSuporte ?? 45,
    ]);
    return result.insertId;
  }

  async update(id: number, data: UpdateQualidadeImpressaoRepositoryDTO): Promise<void> {
    const campos: string[] = [];
    const valores: any[] = [];

    if (data.nome          !== undefined) { campos.push("nome = ?");           valores.push(data.nome); }
    if (data.altura        !== undefined) { campos.push("altura = ?");         valores.push(data.altura); }
    if (data.espessura     !== undefined) { campos.push("espessura = ?");      valores.push(data.espessura); }
    if (data.preenchimento !== undefined) { campos.push("preenchimento = ?");  valores.push(data.preenchimento); }
    if (data.velocidade    !== undefined) { campos.push("velocidade = ?");     valores.push(data.velocidade); }
    if (data.temperaturaBico !== undefined) { campos.push("temperatura_bico = ?"); valores.push(data.temperaturaBico); }
    if (data.temperaturaMesa !== undefined) { campos.push("temperatura_mesa = ?"); valores.push(data.temperaturaMesa); }
    if (data.suporte       !== undefined) { campos.push("suporte = ?");        valores.push(data.suporte); }
    if (data.adesao        !== undefined) { campos.push("adesao = ?");         valores.push(data.adesao); }
    if (data.perimetros    !== undefined) { campos.push("perimetros = ?");     valores.push(data.perimetros); }
    if (data.camadasTopo   !== undefined) { campos.push("camadas_topo = ?");   valores.push(data.camadasTopo); }
    if (data.camadasBase   !== undefined) { campos.push("camadas_base = ?");   valores.push(data.camadasBase); }
    if (data.anguloSuporte !== undefined) { campos.push("angulo_suporte = ?"); valores.push(data.anguloSuporte); }

    if (campos.length === 0) return;
    valores.push(id);
    await db.execute(`UPDATE qualidades SET ${campos.join(", ")} WHERE id = ?`, valores);
  }

  async delete(id: number): Promise<void> {
    await db.execute(`DELETE FROM qualidades WHERE id = ?`, [id]);
  }
}
