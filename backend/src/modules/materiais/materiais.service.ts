import{
    Material,
    MaterialStatus,
    MaterialRepository
} from "./materiais.repository";

export interface CreateMaterialServiceDTO {
    nome: string;
    tipo: string;
    preco: number;
    status: MaterialStatus;
    cor: string;
}

export interface UpdateMaterialServiceDTO {
    nome?: string;
    tipo?: string;
    preco?: number;
    status?: MaterialStatus;
    cor?: string;
}

export class MaterialService {
    constructor(private readonly materialRepository: MaterialRepository){}

    async listar(): Promise<Material[]>{
        return await this.materialRepository.findAll();
    }

    async buscarPorId(id: number): Promise<Material|null>{
        const material = await this.materialRepository.findById(id);

        if(!material){
            return null;
        }
        return material;
    }

    async criar(data: CreateMaterialServiceDTO){
        const id = await this.materialRepository.create({
            nome: data.nome,
            tipo: data.tipo,
            preco: data.preco,
            status: data.status,
            cor: data.cor
        });

        const materialCriado = await this.materialRepository.findById(id);
        return materialCriado;
    }

    async atualizar(id:number, data: UpdateMaterialServiceDTO){
        const material = await this.materialRepository.findById(id);
        
        if(!material){
            throw new Error("Material não encontrado.");
        }

        await this.materialRepository.update(id,{
            nome: data.nome,
            tipo: data.tipo,
            preco: data.preco,
            status: data.status,
            cor: data.cor
        });
        
        const materialAtualizado = await this.materialRepository.findById(id);

        if(!materialAtualizado){
            throw new Error("Erro ao buscar material atualizado.");
        }

        return materialAtualizado;
    }

    async remover(id: number) {
        const material = await this.materialRepository.findById(id);

        if(!material){
            throw new Error("Material não encontrado");          
        }

        await this.materialRepository.delete(id);

        return { message: "Material removido com sucesso"};
    }
}