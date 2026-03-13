import { Request, Response } from "express";
import { ArquivoService } from "./arquivos.service";

export class ArquivoController {
    constructor(
        private readonly arquivoService: ArquivoService) {}

    listar = async (_req: Request, res: Response) => {

        const arquivos = await this.arquivoService.listar();

        return res.json(arquivos);
    };

    buscarPorId = async (req: Request, res: Response) => {

        const id = Number(req.params.id);

        if(Number.isNaN(id)){
            return res.status(400).json({message: "ID inválido."});
        }

        const arquivo = await this.arquivoService.buscarPorId(id);

        if(!arquivo){
            return res.status(404).json({message: "Arquivo não encontrado."});
        }

        return res.json(arquivo);
    };

    criar = async (req: Request, res: Response) => {

        const { pedidoId, nome, tipo, caminho } = req.body;

        if(!nome || !tipo || !caminho){
        return res.status(400).json({
            message: "nome, tipo e caminho são obrigatórios."
        });
        }

        const arquivo = await this.arquivoService.criar({
            pedidoId,
            nome,
            tipo,
            caminho
        });

        return res.status(201).json(arquivo);
    };

    remover = async (req: Request, res: Response) => {

        const id = Number(req.params.id);

        if(Number.isNaN(id)){
            return res.status(400).json({message: "ID inválido."});
        }

        try{

            const result = await this.arquivoService.remover(id);

        return res.json(result);

        }catch(error:any){
            const statusCode = error.message === "Arquivo não encontrado."? 404: 400;

            return res.status(statusCode).json({ message: error.message });
        }
    };
}