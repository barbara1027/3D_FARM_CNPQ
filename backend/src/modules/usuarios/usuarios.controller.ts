import { Request, Response } from "express";
import { UsuarioService } from "./usuarios.service";

export class UsuarioController {
  constructor(private readonly usuarioService: UsuarioService) {}

  /**
   * @swagger
   * /usuarios:
   *   get:
   *     tags: [Usuários]
   *     summary: Lista todos os usuários (apenas admin)
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de usuários
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/UsuarioPublico'
   */
  listar = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.usuarioService.listar());
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /usuarios/{id}:
   *   get:
   *     tags: [Usuários]
   *     summary: Busca usuário por ID
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Usuário encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UsuarioPublico'
   *       404:
   *         description: Usuário não encontrado
   */
  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const usuario = await this.usuarioService.buscarPorId(id);
      if (!usuario) return res.status(404).json({ message: "Usuário não encontrado." });
      return res.status(200).json(usuario);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /usuarios:
   *   post:
   *     tags: [Usuários]
   *     summary: Cria um novo usuário (cadastro público)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateUsuarioDTO'
   *     responses:
   *       201:
   *         description: Usuário criado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/UsuarioPublico'
   *       400:
   *         description: Email já em uso
   */
  criar = async (req: Request, res: Response) => {
    try {
      const { nome, email, senha, nivel } = req.body;
      if (!nome || !email || !senha) {
        return res.status(400).json({ message: "Os campos nome, email e senha são obrigatórios." });
      }
      const nivelValido = nivel === "avancado" ? "avancado" : "iniciante";
      const usuario = await this.usuarioService.criar({ nome, email, senha, tipo: "cliente", nivel: nivelValido });
      return res.status(201).json(usuario);
    } catch (error: any) {
      const statusCode = error.message === "Já existe um usuário com este email." ? 400 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /usuarios/{id}:
   *   put:
   *     tags: [Usuários]
   *     summary: Atualiza dados de um usuário
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/UpdateUsuarioDTO'
   *     responses:
   *       200:
   *         description: Usuário atualizado
   *       404:
   *         description: Usuário não encontrado
   */
  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });

      const caller = req.jwtUser!;
      const isAdmin = caller.tipo === "admin";

      if (!isAdmin && caller.sub !== id) {
        return res.status(403).json({ message: "Sem permissão para alterar este usuário." });
      }

      const { nome, email, senha } = req.body;
      // Somente admins podem promover/rebaixar o tipo; qualquer um pode mudar o próprio nivel
      const tipo  = isAdmin ? req.body.tipo  : undefined;
      const nivel = req.body.nivel === "avancado" || req.body.nivel === "iniciante" ? req.body.nivel : undefined;

      const usuario = await this.usuarioService.atualizar(id, { nome, email, senha, tipo, nivel });
      return res.status(200).json(usuario);
    } catch (error: any) {
      const statusCode =
        error.message === "Usuário não encontrado." ? 404 :
        error.message === "Este email já está em uso." ? 400 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /usuarios/{id}:
   *   delete:
   *     tags: [Usuários]
   *     summary: Remove um usuário (apenas admin)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Usuário removido
   *       404:
   *         description: Usuário não encontrado
   */
  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.usuarioService.remover(id));
    } catch (error: any) {
      const statusCode = error.message === "Usuário não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
