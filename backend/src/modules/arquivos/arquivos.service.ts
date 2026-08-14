import { Arquivo, ArquivoRepository, TipoArquivo } from "./arquivos.repository";

export interface CreateArquivoServiceDTO {
  nome: string;
  tipo: TipoArquivo;
  caminho: string;
  tamanhoMb?: number;
  idUsuario?: number | null;
}

export class ArquivoService {
  constructor(private readonly arquivoRepository: ArquivoRepository) {}

  /** Admin vê todos os arquivos; cliente comum só os seus (Fase 29). */
  async listar(usuario: { tipo: string; sub: number }): Promise<Arquivo[]> {
    return usuario.tipo === "admin"
      ? this.arquivoRepository.findAll()
      : this.arquivoRepository.findByUsuario(usuario.sub);
  }

  async buscarPorId(id: number): Promise<Arquivo | null> {
    return this.arquivoRepository.findById(id);
  }

  async criar(data: CreateArquivoServiceDTO): Promise<Arquivo | null> {
    const id = await this.arquivoRepository.create({ ...data, idUsuario: data.idUsuario ?? null });
    return this.arquivoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const arquivo = await this.arquivoRepository.findById(id);
    if (!arquivo) throw new Error("Arquivo não encontrado.");
    await this.arquivoRepository.delete(id);
    return { message: "Arquivo removido com sucesso." };
  }
}
