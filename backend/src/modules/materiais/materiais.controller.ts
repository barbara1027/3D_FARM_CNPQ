import { Request, Response } from "express";
import { MaterialService } from "./materiais.service";

export class MaterialController{
    constructor(private readonly materialService: MaterialService){}

    listar = async(_req: Request, res: Response) => {
        try{
            const material = await this.materialService.listar();
            return res.status(200).json(material);
        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    };

    buscaPorId = async(req: Request, res: Response) => {
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }
            
            const material = await this.materialService.buscarPorId(id);

            if(!material){
                return res.status(404).json({message: "Material não encontrado."});
            }

            return res.status(200).json(material);
        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    }

    criar = async(req: Request, res: Response) => {
        try{
            const{nome, tipo, preco, status, cor} = res.body;

            if(!nome || !tipo || !preco || !status || !cor){
                return res.status(400).json({message: "Os campos nome, tipo, preço , status e cor são obrigatórios."});
            }
            
            const material = await this.materialService.criar({
                nome,
                tipo,
                preco,
                status,
                cor
            })

            return res.status(201).json(material)

        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    };

    atualizar = async(req: Request, res: Response) => {
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }

            const{nome, tipo, preco, status, cor} = req.body;

            const material = await this.materialService.atualizar(id, {
                nome,
                tipo,
                preco,
                status,
                cor,
            });
            
            return res.status(200).json(material);
        }catch(error: any){
            const status = error.message === "Material não encontrado." ? 404 : 400;
            return res.status(status).json({message: error.message});
        }
    }

    remover = async (req: Request, res: Response) => {
        try {
            const id = Number(req.params.id);

            if (Number.isNaN(id)) {
                return res.status(400).json({ message: "ID inválido." });
            }

            const result = await this.materialService.remover(id);
            return res.status(200).json(result);
        } catch (error: any) {
            const statusCode =
                error.message === "Material não encontrado." ? 404 : 400;

            return res.status(statusCode).json({ message: error.message });
        }
    };

}