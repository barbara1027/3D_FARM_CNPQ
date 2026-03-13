import { db } from "../../database/connection";

export type Printer_status = "Ociosa" | "Imprimindo" | "Indisponivel" | "Aguardando Remoção";
export type Api_protocol = "OCTOPRINT" | "MOONRAKER" | "DUMMY";

export interface Impressora {
    id: number;
    nome: string;
    modelo: string;
    status: Printer_status;
    ip: string;
    api: Api_protocol;
    api_key: string;
}

export interface CreateImpressoraRepositoryDTO{
    nome: string;
    modelo: string;
    status: Printer_status;
    ip: string;
    api: Api_protocol;
    api_key: string;
}

export interface UpdateImpressoraRepositoryDTO{
    nome?: string;
    modelo?: string;
    status?: Printer_status;
    ip?: string;
    api?: Api_protocol;
    api_key?: string;
}

export class ImpressoraRepository{
    async findAll(): Promise<Impressora[]>{
            const[rows]= await db.execute(
                `
                SELECT *
                FROM impressoras
                ORDER by id DESC
                `
            );
            return rows as Impressora[];
    }

    async findById(id: number): Promise<Impressora | null>{
        const [rows] = await db.execute(
            `
            SELECT *
            FROM impressoras
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );
        const impressora = rows as Impressora[];
        return impressora[0] ?? null;
    }

    async create(data: CreateImpressoraRepositoryDTO): Promise<number>{
        const [result]: any = await db.execute(
            `
            INSERT INTO impressoras(
            nome,
            modelo,
            status,
            ip,
            api,
            api_key
            )
            VALUES(?,?,?,?,?,?)
            `,
            [data.nome, data.modelo, data.status, data.ip, data.api, data.api_key,]
        );
        return result.insertId;
    }
    
    async update(id: number, data: UpdateImpressoraRepositoryDTO):Promise<void>{
        const campos: string[] = [];
        const valores: any[]= [];

        if(data.nome !== undefined){
           campos.push("nome= ?");
           valores.push(data.nome); 
        }
        if(data.modelo !== undefined){
            campos.push("modelo= ?");
            valores.push(data.modelo);
        }
        if(data.status !== undefined){
            campos.push("status= ?");
            valores.push(data.status);
        }
        if(data.ip !== undefined){
            campos.push("ip= ?");
            valores.push(data.ip);
        }  
        if(data.api !== undefined){
            campos.push("api= ?");
            valores.push(data.api);
        }
        if(data.api_key !== undefined){
            campos.push("api_key= ?");
            valores.push(data.api_key);
        }

        if (campos.length === 0) {
            return;
        }

        valores.push(id);
        
        await db.execute(
            `
            UPDATE materiais
            SET ${campos.join(", ")}
            WHERE id = ?
            `,
            valores
        );
    }

    async delete(id: number): Promise<void> {
        await db.execute(
            `
            DELETE FROM impressoras
            WHERE id = ?
            `,
            [id]
        );
    }
}


