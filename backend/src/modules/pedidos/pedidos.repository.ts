import { db } from "../../database/connection";

export type StatusPedido = "na_fila" | "em_impressao" | "concluido" | "falhou" | "cancelado";

export interface Pedido {
    id: number;
    nome: string;
    status: StatusPedido;
    preco: number;
    caminhoStl: string;
    descricao: string;
    idMaterial: number;
    idArquivo: number;
    idUsuario: number;
}

export interface CreatePedidoRepositoryDTO {
    nome: string;
    status: StatusPedido;
    preco: number;
    caminhoStl: string;
    descricao: string;
    idMaterial: number;
    idArquivo: number;
    idUsuario: number;
}

export interface UpdatePedidoRepositoryDTO {
    nome?: string;
    status?: StatusPedido;
    preco?: number;
    caminhoStl?: string;
    descricao?: string;
    idMaterial?: number;
    idArquivo?: number;
    idUsuario?: number;
}

export class PedidoRepository {
    

}