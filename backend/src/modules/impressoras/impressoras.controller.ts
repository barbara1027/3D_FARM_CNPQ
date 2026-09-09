import { Request, Response } from "express";
import { ImpressoraService, ImpressoraServiceError } from "./impressoras.service";

function parseId(value: string | string[]): number | undefined {
  const str = Array.isArray(value) ? value[0] : value;
  if (!/^[1-9]\d*$/.test(str)) return undefined;
  const parsed = Number(str);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function statusErroCrud(error: unknown): number {
  return error instanceof ImpressoraServiceError ? error.statusCode : 500;
}

function mensagemErro(error: unknown): string {
  return error instanceof Error ? error.message : "Erro interno.";
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
   *       400:
   *         description: Formato ou tipo inválido
   *       404:
   *         description: Material não encontrado
   *       409:
   *         description: Slot incompatível com a configuração da impressora
   */
  criar = async (req: Request, res: Response) => {
    try {
      const body = req.body ?? {};
      const {
        nome, modelo, status, ip, baseUrl, api, api_key, timeoutMs,
        possuiCfs, larguraMesaMm, profundidadeMesaMm, filamentosCarregados,
        eficiencia, taxaErroRecente, capacidadeDiaHoras,
      } = body;
      const impressora = await this.impressoraService.criar({
        nome, modelo, status,
        ip: ip ?? null, baseUrl: baseUrl ?? null,
        api, api_key: api_key ?? null,
        timeoutMs,
        possuiCfs,
        larguraMesaMm,
        profundidadeMesaMm,
        filamentosCarregados,
        eficiencia,
        taxaErroRecente,
        capacidadeDiaHoras,
      });
      return res.status(201).json(impressora);
    } catch (error: unknown) {
      return res.status(statusErroCrud(error)).json({ message: mensagemErro(error) });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}:
   *   patch:
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
   *       400:
   *         description: Formato ou tipo inválido
   *       404:
   *         description: Impressora não encontrada
   *       409:
   *         description: O CFS possui slots adicionais ocupados
   */
  atualizar = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      const body = req.body ?? {};
      const {
        nome, modelo, status, ip, baseUrl, api, api_key, timeoutMs,
        possuiCfs, larguraMesaMm, profundidadeMesaMm,
        eficiencia, taxaErroRecente, capacidadeDiaHoras,
      } = body;
      const impressora = await this.impressoraService.atualizar(id, {
        nome, modelo, status, ip, baseUrl, api, api_key,
        timeoutMs,
        possuiCfs,
        larguraMesaMm,
        profundidadeMesaMm,
        eficiencia,
        taxaErroRecente,
        capacidadeDiaHoras,
      });
      return res.status(200).json(impressora);
    } catch (error: unknown) {
      return res.status(statusErroCrud(error)).json({ message: mensagemErro(error) });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/slots/{numeroSlot}:
   *   put:
   *     tags: [Impressoras]
   *     summary: Carrega ou troca o filamento de um slot (admin)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: numeroSlot
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 4
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             $ref: '#/components/schemas/CarregarFilamentoDTO'
   *     responses:
   *       200:
   *         description: Impressora com o slot atualizado
   *       400:
   *         description: Formato inválido
   *       404:
   *         description: Impressora ou material não encontrado
   *       409:
   *         description: Slot incompatível com a configuração da impressora
   */
  carregarFilamento = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      const numeroSlot = parseId(req.params.numeroSlot);
      if (id === undefined || numeroSlot === undefined) {
        return res.status(400).json({ message: "ID da impressora ou número do slot inválido." });
      }
      const impressora = await this.impressoraService.carregarFilamento(
        id,
        numeroSlot,
        req.body?.idMaterial,
      );
      return res.status(200).json(impressora);
    } catch (error: unknown) {
      return res.status(statusErroCrud(error)).json({ message: mensagemErro(error) });
    }
  };

  /**
   * @swagger
   * /impressoras/{id}/slots/{numeroSlot}:
   *   delete:
   *     tags: [Impressoras]
   *     summary: Descarrega o filamento de um slot (admin)
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: integer
   *       - in: path
   *         name: numeroSlot
   *         required: true
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 4
   *     responses:
   *       200:
   *         description: Filamento descarregado
   *       400:
   *         description: Número de slot inválido
   *       404:
   *         description: Impressora não encontrada
   *       409:
   *         description: Slot incompatível com a configuração da impressora
   */
  descarregarFilamento = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      const numeroSlot = parseId(req.params.numeroSlot);
      if (id === undefined || numeroSlot === undefined) {
        return res.status(400).json({ message: "ID da impressora ou número do slot inválido." });
      }
      return res.status(200).json(
        await this.impressoraService.descarregarFilamento(id, numeroSlot),
      );
    } catch (error: unknown) {
      return res.status(statusErroCrud(error)).json({ message: mensagemErro(error) });
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
    } catch (error: unknown) {
      return res.status(statusErroCrud(error)).json({ message: mensagemErro(error) });
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

  /**
   * @swagger
   * /impressoras/{id}/parar:
   *   post:
   *     tags: [Impressoras]
   *     summary: Interrompe a impressão em andamento (falha detectada pelo admin) e devolve o pedido para a fila (admin)
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
   *         description: Impressão interrompida, pedido devolvido para a fila
   *       404:
   *         description: Impressora não encontrada
   *       409:
   *         description: O estado da execução mudou antes da interrupção
   */
  pararImpressao = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.pararImpressao(id));
    } catch (error: unknown) {
      if (error instanceof ImpressoraServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      const msg = mensagemErro(error);
      return res.status(msg === "Impressora não encontrada." ? 404 : 400).json({ message: msg });
    }
  };

  confirmarRemocao = async (req: Request, res: Response) => {
    try {
      const id = parseId(req.params.id);
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
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
      if (id === undefined) return res.status(400).json({ message: "ID inválido." });
      return res.status(200).json(await this.impressoraService.obterProgresso(id));
    } catch (error: any) {
      const statusCode = error.message === "Impressora não encontrada." ? 404 : 500;
      return res.status(statusCode).json({ message: error.message });
    }
  };
}
