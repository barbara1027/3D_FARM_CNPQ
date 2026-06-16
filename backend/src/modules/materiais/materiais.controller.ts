import { Request, Response } from "express";
import { MaterialService } from "./materiais.service";

export class MaterialController {
  constructor(private readonly materialService: MaterialService) {}

  /**
   * @swagger
   * /materiais:
   *   get:
   *     tags: [Materiais]
   *     summary: Lista todos os materiais
   *     responses:
   *       200:
   *         description: Lista de materiais
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Material'
   */
  listar = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.materialService.listar());
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /materiais/{id}:
   *   get:
   *     tags: [Materiais]
   *     summary: Busca material por ID
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *     responses:
   *       200:
   *         description: Material encontrado
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Material'
   *       404:
   *         description: Material não encontrado
   */
  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const material = await this.materialService.buscarPorId(id);
      if (!material) return res.status(404).json({ message: "Material não encontrado." });
      return res.status(200).json(material);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /materiais:
   *   post:
   *     tags: [Materiais]
   *     summary: Cria um novo material (admin)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateMaterialDTO'
   *     responses:
   *       201:
   *         description: Material criado
   */
  criar = async (req: Request, res: Response) => {
    try {
      const { nome, tipo, preco, status, cor, diametro,
              tempBicoMin, tempBicoMax, tempMesaMin, tempMesaMax,
              fanMin, fanMax, camadaMin, camadaMax } = req.body;
      if (!nome || !tipo || preco === undefined || !status) {
        return res.status(400).json({ message: "Os campos nome, tipo, preco e status são obrigatórios." });
      }
      return res.status(201).json(await this.materialService.criar({
        nome, tipo, preco, status, cor: cor ?? "",
        diametro: diametro ?? 1.75,
        tempBicoMin: tempBicoMin ?? null, tempBicoMax: tempBicoMax ?? null,
        tempMesaMin: tempMesaMin ?? null, tempMesaMax: tempMesaMax ?? null,
        fanMin: fanMin ?? null, fanMax: fanMax ?? null,
        camadaMin: camadaMin ?? null, camadaMax: camadaMax ?? null,
      }));
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /materiais/{id}:
   *   put:
   *     tags: [Materiais]
   *     summary: Atualiza um material (admin)
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
   *             $ref: '#/components/schemas/UpdateMaterialDTO'
   *     responses:
   *       200:
   *         description: Material atualizado
   *       404:
   *         description: Material não encontrado
   */
  atualizar = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      const { nome, tipo, preco, status, cor, diametro,
              tempBicoMin, tempBicoMax, tempMesaMin, tempMesaMax,
              fanMin, fanMax, camadaMin, camadaMax } = req.body;
      return res.status(200).json(await this.materialService.atualizar(id, {
        nome, tipo, preco, status, cor, diametro,
        tempBicoMin, tempBicoMax, tempMesaMin, tempMesaMax,
        fanMin, fanMax, camadaMin, camadaMax,
      }));
    } catch (error: any) {
      const statusCode = error.message === "Material não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /materiais/{id}:
   *   delete:
   *     tags: [Materiais]
   *     summary: Remove um material (admin)
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
   *         description: Material removido
   *       404:
   *         description: Material não encontrado
   */
  remover = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.materialService.remover(id));
    } catch (error: any) {
      const statusCode = error.message === "Material não encontrado." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
