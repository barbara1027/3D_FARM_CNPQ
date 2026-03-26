import { Request, Response } from "express";
import { UsuarioService } from "./usuarios.service";

export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  listar = async (_req: Request, res: Response) => {
    try {
      const usuarios = await this.usuarioService.listar();
      return res.status(200).json(usuarios);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const usuario = await this.usuarioService.buscarPorId(id);

      if (!usuario) {
        return res.status(404).json({ message: "Usuário não encontrado." });
      }

      return res.status(200).json(usuario);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  criar = async (req: Request, res: Response) => {
    try {
      const { nome, email, senha, tipo } = req.body;

      if (!nome || !email || !senha || !tipo) {
        return res.status(400).json({
          message: "Os campos nome, email, senha e tipo são obrigatórios.",
        });
      }

      const usuario = await this.usuarioService.criar({
        nome,
        email,
        senha,
        tipo,
      });

      return res.status(201).json(usuario);
    } catch (error: any) {
      const statusCode =
        error.message === "Já existe um usuário com este email." ? 400 : 500;

      return res.status(statusCode).json({ message: error.message });
    }
  };

  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const { nome, email, senha, tipo } = req.body;

      const usuario = await this.usuarioService.atualizar(id, {
        nome,
        email,
        senha,
        tipo,
      });

      return res.status(200).json(usuario);
    } catch (error: any) {
      const statusCode =
        error.message === "Usuário não encontrado."
          ? 404
          : error.message === "Este email já está em uso."
            ? 400
            : 500;

      return res.status(statusCode).json({ message: error.message });
    }
  };

  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);

      if (Number.isNaN(id)) {
        return res.status(400).json({ message: "ID inválido." });
      }

      const result = await this.usuarioService.remover(id);
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Usuário não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
