import { Request, Response } from "express";
import { ImpressoraService } from "./impressoras.service";

function parseId(value: string): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export class ImpressoraController {
  constructor(private readonly impressoraService: ImpressoraService) {}

  /**
   * @swagger
   * /impressoras:
   *   get:
   *     tags: [Impressoras]
   *     summary: Lista todas as impressoras
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Lista de impressoras
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Impressora'
   */
  listar = async (_req: Request, res: Response) => {
    try {
      return res.status(200).json(await this.impressoraService.listar());
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}:
   *   get:
   *     tags: [Impressoras]
   *     summary: Busca impressora por ID
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
   *         description: Impressora encontrada
   *       404:
   *         description: Impressora não encontrada
   */
  buscarPorId = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      const impressora = await this.impressoraService.buscarPorId(id);
      if (!impressora) return res.status(404).json({ message: "Impressora não encontrada." });
      return res.status(200).json(impressora);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras:
   *   post:
   *     tags: [Impressoras]
   *     summary: Cadastra uma nova impressora (admin)
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CreateImpressoraDTO'
   *     responses:
   *       201:
   *         description: Impressora criada
   */
  criar = async (req: Request, res: Response) => {
    try {
      const {
        nome, modelo, status, ip, baseUrl, api, api_key, timeoutMs, idMaterial,
        eficiencia, taxaErroRecente, tempoParaFicarLivreHoras, capacidadeDiaHoras,
      } = req.body;
      const materialIdNormalizado = parseOptionalNumber(idMaterial ?? req.body.id_material) ?? null;
      if (!nome || !modelo || !api) {
        return res.status(400).json({ message: "Os campos nome, modelo e api são obrigatórios." });
      }
      const impressora = await this.impressoraService.criar({
        nome, modelo, status,
        ip: ip ?? null, baseUrl: baseUrl ?? null,
        api, api_key: api_key ?? null,
        timeoutMs: parseOptionalNumber(timeoutMs),
        idMaterial: materialIdNormalizado,
        eficiencia: parseOptionalNumber(eficiencia),
        taxaErroRecente: parseOptionalNumber(taxaErroRecente),
        tempoParaFicarLivreHoras: parseOptionalNumber(tempoParaFicarLivreHoras),
        capacidadeDiaHoras: parseOptionalNumber(capacidadeDiaHoras),
      });
      return res.status(201).json(impressora);
    } catch (error: any) {
      return res.status(500).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}:
   *   put:
   *     tags: [Impressoras]
   *     summary: Atualiza dados de uma impressora (admin)
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
   *             $ref: '#/components/schemas/UpdateImpressoraDTO'
   *     responses:
   *       200:
   *         description: Impressora atualizada
   *       404:
   *         description: Impressora não encontrada
   */
  atualizar = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      const {
        nome, modelo, status, ip, baseUrl, api, api_key, timeoutMs, idMaterial,
        eficiencia, taxaErroRecente, tempoParaFicarLivreHoras, capacidadeDiaHoras,
      } = req.body;
      const materialIdNormalizado = parseOptionalNumber(idMaterial ?? req.body.id_material);
      const impressora = await this.impressoraService.atualizar(id, {
        nome, modelo, status, ip, baseUrl, api, api_key,
        timeoutMs: parseOptionalNumber(timeoutMs),
        idMaterial: materialIdNormalizado,
        eficiencia: parseOptionalNumber(eficiencia),
        taxaErroRecente: parseOptionalNumber(taxaErroRecente),
        tempoParaFicarLivreHoras: parseOptionalNumber(tempoParaFicarLivreHoras),
        capacidadeDiaHoras: parseOptionalNumber(capacidadeDiaHoras),
      });
      return res.status(200).json(impressora);
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}:
   *   delete:
   *     tags: [Impressoras]
   *     summary: Remove uma impressora (admin)
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
   *         description: Impressora removida
   *       404:
   *         description: Impressora não encontrada
   */
  remover = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.remover(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/testar-conexao:
   *   post:
   *     tags: [Impressoras]
   *     summary: Testa a conexão com a impressora (admin)
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
   *         description: Resultado do teste de conexão
   */
  testarConexao = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.testarConexao(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/sincronizar:
   *   post:
   *     tags: [Impressoras]
   *     summary: Sincroniza o status físico da impressora (admin)
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
   *         description: Impressora sincronizada
   */
  sincronizarStatus = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.sincronizarStatus(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/atribuir-pedido:
   *   post:
   *     tags: [Impressoras]
   *     summary: Atribui um pedido a uma impressora ociosa (admin)
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
   *             type: object
   *             required: [idPedido]
   *             properties:
   *               idPedido:
   *                 type: integer
   *     responses:
   *       200:
   *         description: Pedido atribuído com sucesso
   *       400:
   *         description: Impressora não está ociosa ou pedido inválido
   */
  atribuirPedido = async (req: Request, res: Response) => {
    try {
      const idImpressora = parseId(req.params.id);
      const idPedido = Number(req.body.idPedido ?? req.body.id_pedido);
      if (idImpressora === undefined || Number.isNaN(idPedido)) {
        return res.status(400).json({ message: "IDs inválidos." });
      }
      return res.status(200).json(await this.impressoraService.atribuirPedido(idImpressora, idPedido));
    } catch (error: any) {
      const message = error.message ?? "Erro interno.";
      console.error(`[atribuir-pedido] impressora=${req.params.id} pedido=${req.body.idPedido} → ${message}`);
      const statusCode = message.includes("não encontrad") ? 404 : 400;
      return res.status(statusCode).json({ message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/liberar:
   *   post:
   *     tags: [Impressoras]
   *     summary: Libera uma impressora manualmente (admin)
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
   *         description: Impressora liberada
   */
  liberar = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.liberar(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  confirmarRemocao = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.confirmarRemocao(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/eventos:
   *   get:
   *     tags: [Impressoras]
   *     summary: Lista o histórico de eventos de uma impressora
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           default: 20
   *     responses:
   *       200:
   *         description: Lista de eventos
   */
  listarEventos = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      const limit = req.query.limit ? Number(req.query.limit) : 20;
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.listarEventos(id, limit));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };

  progresso = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (Number.isNaN(id)) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.obterProgresso(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}