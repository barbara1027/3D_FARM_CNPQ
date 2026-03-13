import { Request, Response } from "express";
import { ImpressoraService } from "./impressoras.service";

export class ImpressoraController{
    constructor(private readonly impressoraService: ImpressoraService){}

    listar = async(_req: Request, res: Response) =>{
        try{
            const impressoras = await this.impressoraService.listar();
            return res.status(200).json(impressoras);
        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    };

    buscarPorId = async(req: Request, res: Response) =>{
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                    return res.status(400).json({ message: "ID inválido."});
            }

            const impressora = await this.impressoraService.buscarPorId(id);

            if(!impressora){
                return res.status(404).json({message: "Impressora não encontrada."});
            }

            return res.status(200).json(impressora)
        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    }

    criar = async(req: Request, res: Response) =>{
        try{
            const{nome, modelo, status, ip, api, api_key} = req.body;

            if(!nome || !modelo || !status || !ip || !api){
                return res.status(400).json({message: "Os campos nome, modelo, status, ip, api são obrigatórios."});
            }

            const impressora = await this.impressoraService.criar({
                nome,
                modelo,
                status,
                ip,
                api,
                api_key
            });

            return res.status(201).json(impressora);
        }catch(error: any){
            return res.status(500).json({message: error.message});
        }
    }

    atualizar = async(req: Request, res: Response) =>{
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }

            const{nome, modelo, status, ip, api, api_key} = req.body;

            const impressora = await this.impressoraService.atualizar(id, {
                nome,
                modelo,
                status,
                ip,
                api,
                api_key
            });

            return res.status(201).json(impressora);
        }catch(error: any){
            const status = error.message === "Impressora não encontrada." ? 404 : 400;
            return res.status(status).json({message: error.message});
        }
    }

    remover = async (req: Request, res: Response) => {
        try {
             const id = Number(req.params.id);

            if (Number.isNaN(id)) {
                return res.status(400).json({ message: "ID inválido." });
            }

            const result = await this.impressoraService.remover(id);
            return res.status(200).json(result);
        }catch(error: any){
            const status = error.message === "Impressora não encontrada." ? 404 : 400;
            return res.status(status).json({message: error.message});
        }
    }


} 