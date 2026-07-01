import { Request, Response } from "express";
import { AuthService } from "./auth.service";
import { db } from "../../database/connection";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * @swagger
   * /auth/login:
   *   post:
   *     tags: [Auth]
   *     summary: Login de usuário (cliente ou admin)
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [email, senha]
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: admin@3dfarm.com
   *               senha:
   *                 type: string
   *                 example: "admin123"
   *     responses:
   *       200:
   *         description: Login realizado com sucesso
   *       401:
   *         description: Credenciais inválidas
   */
  login = async (req: Request, res: Response) => {
    try {
      const { email, senha } = req.body;
      if (!email || !senha) {
        return res.status(400).json({ message: "Email e senha são obrigatórios." });
      }
      const result = await this.authService.login({ email, senha });
      return res.status(200).json(result);
    } catch (error: any) {
      const statusCode = error.message === "Credenciais inválidas." ? 401 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /auth/me:
   *   get:
   *     tags: [Auth]
   *     summary: Retorna dados do usuário autenticado
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dados do usuário logado
   *       401:
   *         description: Não autenticado
   */
  me = async (req: Request, res: Response) => {
    try {
      const payload = req.jwtUser!;
      const [rows]: any = await db.execute(
        "SELECT id, nome, email, tipo, nivel FROM usuarios WHERE id = ? LIMIT 1",
        [payload.sub]
      );
      if (!rows?.length) return res.status(404).json({ message: "Usuário não encontrado." });
      return res.status(200).json(rows[0]);
    } catch (e: any) {
      return res.status(500).json({ message: e.message });
    }
  };
}
