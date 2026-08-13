import { Pedido, PedidoRepository, StatusPedido } from "./pedidos.repository";
import { runAutoSlicePipeline } from "../slicer/auto-slice.service";
import { PedidoImpressoraRepository } from "../fila/pedidoImpressora.repository";

export interface CreatePedidoServiceDTO {
  nome: string;
  descricao?: string | null;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  parametros?: Record<string, any> | null;
  quantidade?: number;
  prioridadePaga?: boolean;
}

export interface UpdatePedidoServiceDTO {
  preco?: number;
  descricao?: string | null;
  status?: StatusPedido;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  tempoGcodeHoras?: number;
  prazoEntregaHoras?: number;
  prazoEntrega?: string | Date | null;
  limiteInicioImpressao?: string | Date | null;
  prioridadePaga?: boolean;
}

export class PedidoService {
  constructor(
    private readonly repo: PedidoRepository,
    private readonly pedidoImpressoraRepository = new PedidoImpressoraRepository(),
  ) {}

  async listar(): Promise<Pedido[]> {
    return this.repo.findAll();
  }

  async listarPorUsuario(idUsuario: number): Promise<Pedido[]> {
    return this.repo.findByUsuario(idUsuario);
  }

  async buscarPorId(id: number): Promise<Pedido | null> {
    return this.repo.findById(id);
  }

  /**
   * Cria o pedido com status "analisando" e dispara o pipeline de fatiamento
   * em background (setImmediate → não bloqueia a resposta HTTP).
   */
  async criar(data: CreatePedidoServiceDTO): Promise<Pedido> {
    const id = await this.repo.create({
      ...data,
      preco:  0,            // será atualizado pelo pipeline
      status: "analisando", // começa analisando
    });

    const pedido = await this.repo.findById(id);
    if (!pedido) throw new Error("Erro ao criar pedido.");

    // Dispara o pipeline em background — retorna imediatamente para o cliente
    setImmediate(() => {
      runAutoSlicePipeline(id).catch((err) => {
        console.error(`[SERVICE] Pipeline falhou para pedido ${id}:`, err.message);
      });
    });

    return pedido;
  }

  async atualizar(id: number, data: UpdatePedidoServiceDTO): Promise<Pedido> {
    const pedido = await this.repo.findById(id);
    if (!pedido) throw new Error("Pedido não encontrado.");

    if (data.status === "cancelado") {
      const cancelamento = await this.pedidoImpressoraRepository
        .cancelarPlanejamentoDoPedido(id);
      if (cancelamento === "pedido_nao_encontrado") {
        throw new Error("Pedido não encontrado.");
      }
      if (cancelamento === "execucao_ativa") {
        throw new Error("Não é possível cancelar um pedido reservado ou em impressão.");
      }

      const demaisCampos = { ...data };
      delete demaisCampos.status;
      const resultado = await this.repo.update(id, demaisCampos);
      if (resultado === "not_found") throw new Error("Pedido não encontrado.");
      if (resultado === "execution_active") {
        throw new Error("O pedido entrou em execução durante a atualização.");
      }
    } else if (data.status !== undefined) {
      throw new Error(
        "O status operacional do pedido só pode ser alterado pelas transições da fila.",
      );
    } else {
      const resultado = await this.repo.update(id, data);
      if (resultado === "not_found") throw new Error("Pedido não encontrado.");
      if (resultado === "execution_active") {
        throw new Error(
          "Não é possível alterar material, qualidade ou arquivo de um pedido reservado ou em impressão.",
        );
      }
    }
    const updated = (await this.repo.findById(id))!;

    return updated;
  }

  async remover(id: number): Promise<{ message: string }> {
    const resultado = await this.repo.delete(id);
    if (resultado === "not_found") throw new Error("Pedido não encontrado.");
    if (resultado === "status_blocked") {
      throw new Error("Não é possível remover um pedido ativo ou concluído.");
    }
    if (resultado === "execution_active") {
      throw new Error("Não é possível remover um pedido com alocação ativa.");
    }
    return { message: "Pedido removido com sucesso." };
  }
}
