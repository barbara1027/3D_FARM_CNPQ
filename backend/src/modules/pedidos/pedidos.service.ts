import { Pedido, PedidoRepository, StatusPedido } from "./pedidos.repository";

export interface CreatePedidoServiceDTO {
  nome: string;
  preco: number;
  descricao?: string;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
}

export interface UpdatePedidoServiceDTO {
  preco?: number;
  descricao?: string | null;
  idUsuario?: number;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  status?: StatusPedido;
}

export class PedidoService {
  constructor(private readonly pedidoRepository: PedidoRepository) {}

  async listar(): Promise<Pedido[]> {
    return this.pedidoRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Pedido | null> {
    return this.pedidoRepository.findById(id);
  }

  async criar(data: CreatePedidoServiceDTO): Promise<Pedido | null> {
    const id = await this.pedidoRepository.create({
      ...data,
      status: "na_fila",
    });

    return this.pedidoRepository.findById(id);
  }

  async atualizar(id: number, data: UpdatePedidoServiceDTO): Promise<Pedido | null> {
    const pedido = await this.pedidoRepository.findById(id);

    if (!pedido) {
      throw new Error("Pedido não encontrado.");
    }

    await this.pedidoRepository.update(id, data);
    return this.pedidoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const pedido = await this.pedidoRepository.findById(id);

    if (!pedido) {
      throw new Error("Pedido não encontrado.");
    }

    await this.pedidoRepository.delete(id);
    return { message: "Pedido removido com sucesso." };
  }
}
