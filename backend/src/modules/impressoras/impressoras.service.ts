import{
    Impressora,
    ImpressoraRepository,
    Printer_status,
    Api_protocol
}"./impressoras.repository"

export interface CreateImpressoraServiceDTO{
    nome: string;
    modelo: string;
    status: Printer_status;
    ip: string;
    api: Api_protocol;
    api_key: string;
}

export interface UpdateImpressoraServiceDTO{
    nome?: string;
    modelo?: string;
    status?: Printer_status;
    ip?: string;
    api?: Api_protocol;
    api_key?: string;
}

export class ImpressoraService{
    constructor(private readonly impressoraRepository: ImpressoraRepository){}

    async listar(): Promise<Impressora[]>{
        return await this.impressoraRepository.findAll();
    }

    async buscarPorId(id: number): Promise<Impressora | null>{
        const impressora = await this.impressoraRepository.findById(id)

        if(!impressora){
            return null;
        }
        
        return impressora;
    }

    async criar(data: CreateImpressoraServiceDTO){
        const id = await this.impressoraRepository.create({
            nome: data.nome,
            modelo: data.modelo,
            status: data.status,
            ip: data.ip,
            api: data.api,
            api_key: data.api_key
        });
    }

    async atualizar(id: number, data:UpdateImpressoraServiceDTO){
        const impressora = await this.impressoraRepository.findById(id);

        if(!impressora){
            throw new Error("Impressora não encontrada.");
        }

        await this.impressoraRepository.update(id,{
            nome: data.nome,
            modelo: data.modelo,
            status: data.status,
            ip: data.ip,
            api: data.api,
            api_key: data.api_key
        });

        const impressoraAtualizada = await this.impressoraRepository.findById(id);

        if(!impressoraAtualizada){
            throw new Error("Erro ao buscar impressora atualizada.");
        }

        return impressoraAtualizada;
    }

    async remover(id: number) {
        const impressora = await this.impressoraRepository.findById(id);

        if(!impressora){
            throw new Error("Impressora não encontrada");          
        }

        await this.impressoraRepository.delete(id);

        return { message: "Impressora removida com sucesso"};
    }
}