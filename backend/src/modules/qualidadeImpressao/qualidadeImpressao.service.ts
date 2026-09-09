import { QualidadeImpressao, QualidadeImpressaoRepository } from "./qualidadeImpressao.repository";

export interface CreateQualidadeImpressaoServiceDTO {
  nome?: string;
  altura: number;
  espessura: number;
  velocidade: number;
  suporte: number;
  adesao: number;
  perimetros?: number;
  camadasTopo?: number;
  camadasBase?: number;
  anguloSuporte?: number;
}

export interface UpdateQualidadeImpressaoServiceDTO {
  nome?: string;
  altura?: number;
  espessura?: number;
  velocidade?: number;
  suporte?: number;
  adesao?: number;
  perimetros?: number;
  camadasTopo?: number;
  camadasBase?: number;
  anguloSuporte?: number;
}

export class QualidadeImpressaoService {
  constructor(private readonly qualidadeImpressaoRepository: QualidadeImpressaoRepository) {}

  async listar(): Promise<QualidadeImpressao[]> {
    return this.qualidadeImpressaoRepository.findAll();
  }

  async buscarPorId(id: number): Promise<QualidadeImpressao | null> {
    return this.qualidadeImpressaoRepository.findById(id);
  }

  async criar(data: CreateQualidadeImpressaoServiceDTO): Promise<QualidadeImpressao | null> {
    const id = await this.qualidadeImpressaoRepository.create(data);
    return this.qualidadeImpressaoRepository.findById(id);
  }

  async atualizar(id: number, data: UpdateQualidadeImpressaoServiceDTO): Promise<QualidadeImpressao | null> {
    if (!(await this.qualidadeImpressaoRepository.findById(id))) {
      throw new Error("Qualidade não encontrada.");
    }
    await this.qualidadeImpressaoRepository.update(id, data);
    return this.qualidadeImpressaoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    if (!(await this.qualidadeImpressaoRepository.findById(id))) {
      throw new Error("Qualidade não encontrada.");
    }
    try {
      await this.qualidadeImpressaoRepository.delete(id);
    } catch (e: any) {
      // Mesmo tratamento de MaterialService.remover: sem isso, a violação da
      // FK fk_pedidos_qualidade (ON DELETE RESTRICT) vazava como 500 com o
      // erro cru do MySQL em vez de um 409 de conflito.
      if (e.code === "ER_ROW_IS_REFERENCED_2" || e.errno === 1451) {
        throw new Error("Esta qualidade está vinculada a pedidos e não pode ser removida.");
      }
      throw e;
    }
    return { message: "Qualidade removida com sucesso." };
  }
}
