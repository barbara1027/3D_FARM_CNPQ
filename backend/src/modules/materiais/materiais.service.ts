import { Material, MaterialRepository, MaterialStatus } from "./materiais.repository";

export interface CreateMaterialServiceDTO {
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
}

export interface UpdateMaterialServiceDTO {
  nome?: string;
  tipo?: string;
  preco?: number;
  status?: MaterialStatus;
  cor?: string;
}

export class MaterialService {
  constructor(private readonly materialRepository: MaterialRepository) {}

  async listar(): Promise<Material[]> {
    return this.materialRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Material | null> {
    return this.materialRepository.findById(id);
  }

  async criar(data: CreateMaterialServiceDTO): Promise<Material | null> {
    const id = await this.materialRepository.create(data);
    return this.materialRepository.findById(id);
  }

  async atualizar(
    id: number,
    data: UpdateMaterialServiceDTO,
  ): Promise<Material | null> {
    const material = await this.materialRepository.findById(id);

    if (!material) {
      throw new Error("Material não encontrado.");
    }

    await this.materialRepository.update(id, data);
    return this.materialRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const material = await this.materialRepository.findById(id);

    if (!material) {
      throw new Error("Material não encontrado.");
    }

    await this.materialRepository.delete(id);
    return { message: "Material removido com sucesso." };
  }
}
