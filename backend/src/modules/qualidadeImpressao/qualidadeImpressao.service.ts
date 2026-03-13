import {
  QualidadeImpressao,
  QualidadeImpressaoRepository,
} from "./qualidadeImpressao.repository";

export interface CreateQualidadeImpressaoServiceDTO {
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
}

export interface UpdateQualidadeImpressaoServiceDTO {
  altura?: number;
  espessura?: number;
  preenchimento?: number;
  velocidade?: number;
  temperaturaBico?: number;
  temperaturaMesa?: number;
  suporte?: number;
  adesao?: number;
}

export class QualidadeImpressaoService {
  constructor(
    private readonly qualidadeImpressaoRepository: QualidadeImpressaoRepository
  ) {}

  async listar(): Promise<QualidadeImpressao[]> {
    return this.qualidadeImpressaoRepository.findAll();
  }

  async buscarPorId(id: number): Promise<QualidadeImpressao | null> {
    return this.qualidadeImpressaoRepository.findById(id);
  }

  async criar(
    data: CreateQualidadeImpressaoServiceDTO
  ): Promise<QualidadeImpressao | null> {
    const id = await this.qualidadeImpressaoRepository.create({
      altura: data.altura,
      espessura: data.espessura,
      preenchimento: data.preenchimento,
      velocidade: data.velocidade,
      temperaturaBico: data.temperaturaBico,
      temperaturaMesa: data.temperaturaMesa,
      suporte: data.suporte,
      adesao: data.adesao,
    });

    return this.qualidadeImpressaoRepository.findById(id);
  }

  async atualizar(
    id: number,
    data: UpdateQualidadeImpressaoServiceDTO
  ): Promise<QualidadeImpressao | null> {
    const qualidade = await this.qualidadeImpressaoRepository.findById(id);

    if (!qualidade) {
      throw new Error("Qualidade não encontrada.");
    }

    await this.qualidadeImpressaoRepository.update(id, {
      altura: data.altura,
      espessura: data.espessura,
      preenchimento: data.preenchimento,
      velocidade: data.velocidade,
      temperaturaBico: data.temperaturaBico,
      temperaturaMesa: data.temperaturaMesa,
      suporte: data.suporte,
      adesao: data.adesao,
    });

    return this.qualidadeImpressaoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const qualidade = await this.qualidadeImpressaoRepository.findById(id);

    if (!qualidade) {
      throw new Error("Qualidade não encontrada.");
    }

    await this.qualidadeImpressaoRepository.delete(id);

    return { message: "Qualidade removida com sucesso." };
  }
}