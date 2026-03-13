import { Request, Response } from "express";
import { PedidoService } from "./pedidos.service";

export class PedidoController {
    constructor(private readonly pedidoService: PedidoService) {}

    listar = async (_req: Request, res: Response) => {
        const pedidos = await this.pedidoService.listar();
        return res.json(pedidos);
    };

    buscarPorId = async (req: Request, res: Response) => {

        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "ID inválido." });
        }

        const pedido = await this.pedidoService.buscarPorId(id);

        if (!pedido) {
            return res.status(404).json({ message: "Pedido não encontrado." });
        }

        return res.json(pedido);
    };

    criar = async (req: Request, res: Response) => {

        const {nome, preco, descricao, idUsuario, idMaterial, idQualidade, idArquivo } = req.body;

        if (!nome || !preco || !idUsuario || !idMaterial || !idQualidade|| !idArquivo) {
            return res.status(400).json({
                message:
                "Os campus nome, preco, idUsuario, idMaterial, idQualidade, idArquivo  são obrigatórios."
            });
        }

        const pedido = await this.pedidoService.criar({
            nome,
            preco,
            descricao,
            idUsuario,
            idMaterial,
            idQualidade,
            idArquivo
        });

        return res.status(201).json(pedido);
    };

    atualizar = async (req: Request, res: Response) => {

        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "ID inválido." });
        }try{
            const pedido = await this.pedidoService.atualizar(id, req.body);

            return res.json(pedido);

        } catch (error: any) {

        const statusCode = error.message === "Pedido não encontrado." ? 404 : 400;

        return res.status(statusCode).json({message: error.message});
        }
    };

    remover = async (req: Request, res: Response) => {
        const id = Number(req.params.id);

        if (Number.isNaN(id)) {
            return res.status(400).json({ message: "ID inválido." });
        }try{
            const result = await this.pedidoService.remover(id);

            return res.json(result);
        }catch (error: any){
            const statusCode =
            error.message === "Pedido não encontrado." ? 404 : 400;

            return res.status(statusCode).json({message: error.message});
        }
    };
}