import { Arquivo, ArquivoRepository, TipoArquivo } from "./arquivos.repository";

export interface CreateArquivoServiceDTO {
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
  tamanhoMb?: number;
}

export class ArquivoService {
  constructor(private readonly arquivoRepository: ArquivoRepository) {}

  async listar(): Promise<Arquivo[]> {
    return this.arquivoRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Arquivo | null> {
    return this.arquivoRepository.findById(id);
  }

  async criar(data: CreateArquivoServiceDTO): Promise<Arquivo | null> {
    const id = await this.arquivoRepository.create(data);
    return this.arquivoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const arquivo = await this.arquivoRepository.findById(id);
    if (!arquivo) throw new Error("Arquivo não encontrado.");
    await this.arquivoRepository.delete(id);
    return { message: "Arquivo removido com sucesso." };
  }
}
