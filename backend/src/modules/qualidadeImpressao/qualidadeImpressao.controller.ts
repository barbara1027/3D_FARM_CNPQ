import { Request, Response } from "express";
import { QualidadeImpressaoService } from "./qualidadeImpressao.service";

export class QualidadeImpressaoController {
  constructor(private readonly qualidadeImpressaoService: QualidadeImpressaoService) {}

  /**
   * @swagger
   * /qualidades:
   *   get:
   *     tags: [Qualidades]
   *     summary: Lista todos os presets de qualidade de impressão
   *     responses:
   *       200:
   *         description: Lista de qualidades
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/QualidadeImpressao'
   */
  listar = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.qualidadeImpressaoService.listar());
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /qualidades/{id}:
   *   get:
   *     tags: [Qualidades]
   *     summary: Busca qualidade por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Qualidade encontrada
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/QualidadeImpressao'
   *       404:
   *         description: Qualidade não encontrada
   */
  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const qualidade = await this.qualidadeImpressaoService.buscarPorId(id);
      if (!qualidade) return res.status(404).json({ message: "Qualidade não encontrada." });
      return res.status(200).json(qualidade);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /qualidades:
   *   post:
   *     tags: [Qualidades]
   *     summary: Cria um novo preset de qualidade (admin)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateQualidadeDTO'
   *     responses:
   *       201:
   *         description: Qualidade criada
   */
  criar = async (req: Request, res: Response) => {
    try {
      const { nome, altura, espessura, velocidade,
              suporte, adesao, perimetros, camadasTopo, camadasBase, anguloSuporte } = req.body;
      if (
        altura === undefined || espessura === undefined ||
        velocidade === undefined || suporte === undefined || adesao === undefined
      ) {
        return res.status(400).json({ message: "Todos os parâmetros de impressão são obrigatórios." });
      }
      return res.status(201).json(await this.qualidadeImpressaoService.criar({
        nome: nome ?? "",
        altura, espessura, velocidade, suporte, adesao,
        perimetros, camadasTopo, camadasBase, anguloSuporte,
      }));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /qualidades/{id}:
   *   put:
   *     tags: [Qualidades]
   *     summary: Atualiza um preset de qualidade (admin)
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
   *             $ref: '#/components/schemas/UpdateQualidadeDTO'
   *     responses:
   *       200:
   *         description: Qualidade atualizada
   *       404:
   *         description: Qualidade não encontrada
   */
  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const { nome, altura, espessura, velocidade,
              suporte, adesao, perimetros, camadasTopo, camadasBase, anguloSuporte } = req.body;
      return res.status(200).json(await this.qualidadeImpressaoService.atualizar(id, {
        nome, altura, espessura, velocidade,
        suporte, adesao, perimetros, camadasTopo, camadasBase, anguloSuporte,
      }));
    } catch (error: any) {
      const statusCode = error.message === "Qualidade não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /qualidades/{id}:
   *   delete:
   *     tags: [Qualidades]
   *     summary: Remove um preset de qualidade (admin)
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
   *         description: Qualidade removida
   *       404:
   *         description: Qualidade não encontrada
   */
  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.qualidadeImpressaoService.remover(id));
    } catch (error: any) {
      const statusCode = error.message === "Qualidade não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
