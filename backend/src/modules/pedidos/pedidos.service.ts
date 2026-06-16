import { Pedido, PedidoRepository, StatusPedido } from "./pedidos.repository";
import { runAutoSlicePipeline } from "../slicer/auto-slice.service";

export interface CreatePedidoServiceDTO {
  nome: string;
  descricao?: string | null;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  parametros?: Record<string, any> | null;
  quantidade?: number;
}

export interface UpdatePedidoServiceDTO {
  preco?: number;
  descricao?: string | null;
  status?: StatusPedido;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
}

export class PedidoService {
  constructor(private readonly repo: PedidoRepository) {}

  async listar(): Promise<Pedido[]> {
    return this.repo.findAll();
  }

  async listarPorUsuario(idUsuario: number): Promise<Pedido[]> {
    return this.repo.findByUsuario(idUsuario);
  }

  async buscarPorId(id: number): Promise<Pedido | null> {
    return this.repo.findById(id);
  }

  /**
   * Cria o pedido com status "analisando" e dispara o pipeline de fatiamento
   * em background (setImmediate → não bloqueia a resposta HTTP).
   */
  async criar(data: CreatePedidoServiceDTO): Promise<Pedido> {
    const id = await this.repo.create({
      ...data,
      preco:  0,            // será atualizado pelo pipeline
      status: "analisando", // começa analisando
    });

    const pedido = await this.repo.findById(id);
    if (!pedido) throw new Error("Erro ao criar pedido.");

    // Dispara o pipeline em background — retorna imediatamente para o cliente
    setImmediate(() => {
      runAutoSlicePipeline(id).catch((err) => {
        console.error(`[SERVICE] Pipeline falhou para pedido ${id}:`, err.message);
      });
    });

    return pedido;
  }

  async atualizar(id: number, data: UpdatePedidoServiceDTO): Promise<Pedido> {
    const pedido = await this.repo.findById(id);
    if (!pedido) throw new Error("Pedido não encontrado.");
    await this.repo.update(id, data);
    return (await this.repo.findById(id))!;
  }

  async remover(id: number): Promise<{ message: string }> {
    const pedido = await this.repo.findById(id);
    if (!pedido) throw new Error("Pedido não encontrado.");
    const bloqueados: StatusPedido[] = ["em_impressao", "na_fila", "concluido"];
    if (bloqueados.includes(pedido.status)) {
      throw new Error(`Não é possível remover um pedido com status "${pedido.status}".`);
    }
    await this.repo.delete(id);
    return { message: "Pedido removido com sucesso." };
  }
}
