import { Pedido, PedidoRepository, StatusPedido } from "./pedidos.repository";
import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { EtaEntregaService } from "./etaEntrega.service";

export interface CreatePedidoServiceDTO {
  nome: string;
  preco: number;
  descricao?: string;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  tempoGcodeHoras: number;
  prioridadePaga?: boolean;
}

export interface UpdatePedidoServiceDTO {
  preco?: number;
  descricao?: string | null;
  idUsuario?: number;
  idMaterial?: number;
  idQualidade?: number;
  idArquivo?: number;
  status?: StatusPedido;
  tempoGcodeHoras?: number;
  prazoEntregaHoras?: number;
  prazoEntrega?: string | Date | null;
  limiteInicioImpressao?: string | Date | null;
  prioridadePaga?: boolean;
}

export class PedidoService {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly etaEntregaService = new EtaEntregaService(
      pedidoRepository,
      new ImpressoraRepository(),
    ),
  ) {}

  async listar(): Promise<Pedido[]> {
    return this.pedidoRepository.findAll();
  }

  async buscarPorId(id: number): Promise<Pedido | null> {
    return this.pedidoRepository.findById(id);
  }

  async criar(data: CreatePedidoServiceDTO): Promise<Pedido | null> {
    if (!Number.isFinite(data.tempoGcodeHoras) || data.tempoGcodeHoras <= 0) {
      throw new Error("tempoGcodeHoras e obrigatorio e deve ser maior que zero.");
    }

    const eta = await this.etaEntregaService.calcularParaNovoPedido({
      idMaterial: data.idMaterial,
      tempoGcodeHoras: data.tempoGcodeHoras,
      prioridadePaga: data.prioridadePaga,
    });

    const id = await this.pedidoRepository.create({
      ...data,
      status: "na_fila",
      prazoEntregaHoras: eta.prazoEntregaHoras,
      prazoEntrega: eta.prazoEntrega,
      prazoEntregaOriginal: eta.prazoEntregaOriginal,
      limiteInicioImpressao: eta.limiteInicioImpressao,
      etaHorasEstimado: eta.etaHorasEstimado,
      etaCalculadoEm: eta.etaCalculadoEm,
      tempoMaximoEsperaHoras: eta.tempoMaximoEsperaHoras,
      tempoExecFarmHoras: eta.tempoExecFarmHoras,
      bufferPrioridadeHoras: eta.bufferPrioridadeHoras,
      bufferSegurancaHoras: eta.bufferSegurancaHoras,
    });

    return this.pedidoRepository.findById(id);
  }

  async atualizar(id: number, data: UpdatePedidoServiceDTO): Promise<Pedido | null> {
    const pedido = await this.pedidoRepository.findById(id);

    if (!pedido) {
      throw new Error("Pedido nao encontrado.");
    }

    await this.pedidoRepository.update(id, data);
    return this.pedidoRepository.findById(id);
  }

  async remover(id: number): Promise<{ message: string }> {
    const pedido = await this.pedidoRepository.findById(id);

    if (!pedido) {
      throw new Error("Pedido nao encontrado.");
    }

    await this.pedidoRepository.delete(id);
    return { message: "Pedido removido com sucesso." };
  }
}
