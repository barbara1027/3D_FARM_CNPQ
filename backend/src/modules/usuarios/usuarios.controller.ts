import { Request, Response } from "express";
import { UsuarioService } from "./usuarios.service";

export class UsuarioController{
    constructor(private readonly UsuarioService: UsuarioService){}

    listar = async(_req: Request, res:Response) =>{
        try{
            const usuarios = await this.UsuarioService.listar();
            return res.status(200).json(usuarios);
        } catch (error: any) {
            return res.status(500).json({messafe: error.message});
        }
    };

    buscarPorId = async(req: Request, res: Response) => {
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }

            const usuario = await this.UsuarioService.buscaPorId(id);

            if(!usuario){
                return res.status(404).json({ message: "Usuário não Encontrado."});
            }

            return res.status(200).json(usuario);
        } catch(error: any) {
            return res.status(500).json({message: error.message});

        }
    };

    criar = async(req: Request, res: Response) => {
        try{
            const{nome, email, senha, tipo} = req.body;

            if(!nome || !email || !senha || !tipo){
                return res.status(400).json({message: "Os campos nome, email, senha e tipo são obrigatórios."});
            }

            const usuario = await this.UsuarioService.criar({
                nome,
                email,
                senha,
                tipo,
            });

            return res.status(200).json(usuario);
        }catch(error: any){
            return res.status(500).json({message: error.message})
        }
    };

    atualizar = async(req: Request, res: Response) => {
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }

            const {nome, email, senha, tipo} = req.bory;

            const usario = await this.UsuarioService.atualizar(id, {
                nome,
                email,
                senha,
                tipo,
            });
            return res.status(200).json(usario);
        }catch(error: any){
            const status = error.message === "Usuário não encontrado." ? 404 : 400;
            return res.status(status).json({message: error.message});
        }
    };

    remover = async(req: Request, res: Response) => {
        try{
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }

            const result = await this.UsuarioService.remover(id);

            return res.status(200).json(result);
        }catch (error: any){
            const id = Number(req.params.id);

            if(Number.isNaN(id)){
                return res.status(400).json({ message: "ID inválido."});
            }
        }
    };

}