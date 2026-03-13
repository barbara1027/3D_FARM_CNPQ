import {
    Pedido,
    PedidoRepository,
    StatusPedido
} from "./pedidos.repository";

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
    status?: StatusPedido;
}

export class PedidoService {
    constructor(private readonly pedidoRepository: PedidoRepository) {}

    async listar(): Promise<Pedido[]> {
        return this.pedidoRepository.findAll();
    }

    async buscarPorId(id: number): Promise<Pedido | null> {
        const pedido = this.pedidoRepository.findById(id);

        if(!pedido){
            return null;
        }

        return pedido;

    }

    
    async criar(data: CreatePedidoServiceDTO): Promise<Pedido | null> {
         const id = await this.pedidoRepository.create({
            nome: data.nome,
            preco: data.preco,
            descricao: data.descricao,
            idUsuario: data.idUsuario,
            idMaterial: data.idMaterial,
            idQualidade: data.idQualidade,
            idArquivo: data.idArquivo,
            status: "na_fila",
        });

        const pedidoCriado = await this.pedidoRepository.findById(id);
        return pedidoCriado;
    }

    async atualizar(id:number, data: UpdatePedidoServiceDTO): Promise<Pedido | null>{
        const pedido = await this.pedidoRepository.findById(id);

        if (!pedido) {
            throw new Error("Pedido não encontrado.");
        }

        await this.pedidoRepository.update(id, {
            preco: data.preco,
            status: data.status,
        });

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