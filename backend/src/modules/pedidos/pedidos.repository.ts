import { db } from "../../database/connection";

export type StatusPedido = "na_fila" | "em_impressao" | "concluido" | "falhou" | "cancelado";

export interface Pedido {
    id: number;
    nome: string;
    preco: number;
    descricao?: string;
    idUsuario: number;
    idMaterial: number;
    idQualidade: number;
    idArquivo: number;
    status: StatusPedido;
}

export interface CreatePedidoRepositoryDTO {
    nome: string;
    preco: number;
    descricao?: string;
    idUsuario: number;
    idMaterial: number;
    idQualidade: number;
    idArquivo: number;
    status: StatusPedido;
}

export interface UpdatePedidoRepositoryDTO {
    preco?: number;
    status?: StatusPedido;
}

export class PedidoRepository {
    async findAll(): Promise<Pedido[]>{
        const[rows] = await db.execute(
            `
            SELECT id, preco, descricao As descricao,  idUsuario AS idUsuario, idMaterial AS idMaterial, idQualidade AS idQualidade, idArquivo AS idArquivo, status
            FROM pedidos
            ORDER BY id DESC
            `
        );
        return rows as Pedido[];
    }

    async findById(id: number): Promise<Pedido | null> {
        const[rows] = await db.execute(
            `
            SELECT id, preco, descricao As descricao,  idUsuario AS idUsuario, idMaterial AS idMaterial, idQualidade AS idQualidade, idArquivo AS idArquivo, status
            FROM pedidos
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        const pedido = rows as Pedido[];
        return pedido[0] ?? null;
    }

    async create(data: CreatePedidoRepositoryDTO): Promise<number>{
        const [result]: any= await db.execute(
            `
            INSERT INTO pedidos(
                nome,
                preco,
                descricao,
                idUsuario,
                idMaterial,
                idQualidade,
                idArquivo,
                status
            )
            VALUES(?,?,?,?,?,?,?,?)
            `,
            [data.nome, data.preco, data.descricao ?? null , data.idUsuario, data.idMaterial, data.idQualidade, data.idArquivo, data.status]
        );
        return result.insertId;
    }

    async update(id: number, data: UpdatePedidoRepositoryDTO): Promise<void>{
        const campos: string[] = [];
        const valores: any[] = [];

        if (data.status !== undefined) {
            campos.push("status = ?");
            valores.push(data.status);
        }

        if (campos.length === 0) {
            return;
        }

        valores.push(id);

        await db.execute(
            `
            UPDATE pedidos
            SET ${campos.join(", ")}
            WHERE id = ?
            `,
            valores
        );
    }

    async delete(id: number): Promise<void> {
        await db.execute(
            `
            DELETE FROM pedidos
            WHERE id = ?
            `,
            [id]
        );
     }


}