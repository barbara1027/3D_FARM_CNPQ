import {
  ApiProtocol,
  Impressora,
  ImpressoraRepository,
  PrinterStatus,
} from "./impressoras.repository";

export interface CreateImpressoraServiceDTO {
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip?: string | null;
  api: ApiProtocol;
  api_key?: string | null;
  idMaterial?: number | null;
}

export interface UpdateImpressoraServiceDTO {
  nome?: string;
  modelo?: string;
  status?: PrinterStatus;
  ip?: string | null;
  api?: ApiProtocol;
  api_key?: string | null;
  idMaterial?: number | null;
}

export class ImpressoraService {
  constructor(private readonly impressoraRepository: ImpressoraRepository) {}

  async listar(): Promise<Impressora[]> {
    return this.impressoraRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Impressora | null> {
    return this.impressoraRepository.findById(id);
  }

  async criar(data: CreateImpressoraServiceDTO): Promise<Impressora | null> {
    const id = await this.impressoraRepository.create(data);
    return this.impressoraRepository.findById(id);
  }

  async atualizar(
    id: number,
    data: UpdateImpressoraServiceDTO,
  ): Promise<Impressora | null> {
    const impressora = await this.impressoraRepository.findById(id);

    if (!impressora) {
      throw new Error("Impressora não encontrada.");
    }

    await this.impressoraRepository.update(id, data);
    return this.impressoraRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const impressora = await this.impressoraRepository.findById(id);

    if (!impressora) {
      throw new Error("Impressora não encontrada.");
    }

    await this.impressoraRepository.delete(id);
    return { message: "Impressora removida com sucesso." };
  }
}
