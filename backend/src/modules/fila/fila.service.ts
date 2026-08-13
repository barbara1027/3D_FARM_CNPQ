import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import {
  AlocacaoPlanejada,
  FilaOtimizacaoService,
  ImpressoraOtimizacao,
  PedidoOtimizacao,
} from "./filaOtimizacao.service";
import { PedidoImpressoraRepository } from "./pedidoImpressora.repository";

const HORAS_OPERADOR_DIA_PADRAO = 4;

function getHorasOperadorDiaPadrao(): number {
  const valor = Number(process.env.HORAS_OPERADOR_DIA ?? HORAS_OPERADOR_DIA_PADRAO);
  return Number.isFinite(valor) && valor > 0 ? valor : HORAS_OPERADOR_DIA_PADRAO;
}

export class FilaService {
  private otimizacao = new FilaOtimizacaoService();

  constructor(
    private pedidoRepo: PedidoRepository,
    private impressoraRepo: ImpressoraRepository,
    private horasOperadorDisponiveisPadrao = getHorasOperadorDiaPadrao(),
    private pedidoImpressoraRepo = new PedidoImpressoraRepository(),
  ) {}

  async reescalonarFilaVirtual(
    horasOperadorDisponiveis = this.horasOperadorDisponiveisPadrao,
  ): Promise<AlocacaoPlanejada[]> {
    console.log("[FilaService] Iniciando reescalonamento dinamico...");

    const pedidosBrutos = await this.pedidoRepo.findPendentesParaOtimizacao();
    const impressorasBrutas = await this.impressoraRepo.findParaOtimizacao();

    const pedidos = pedidosBrutos.map((pedido) => ({
      id: Number(pedido.id),
      idMaterial: Number(pedido.idMaterial),
      tempoGcodeHoras: Number(pedido.tempoGcodeHoras),
      prazoEntregaHoras: Number(pedido.prazoEntregaHoras),
      tempoMaximoEsperaHoras:
        pedido.tempoMaximoEsperaHoras == null ? null : Number(pedido.tempoMaximoEsperaHoras),
      limiteInicioImpressao: pedido.limiteInicioImpressao ?? null,
      criadoEm: pedido.criadoEm,
      prioridadePaga: Boolean(pedido.prioridadePaga),
    })) as PedidoOtimizacao[];

    const impressoras = impressorasBrutas.map((impressora) => ({
      id: Number(impressora.id),
      idMaterialAtual:
        impressora.idMaterialAtual === null ? null : Number(impressora.idMaterialAtual),
      possuiCfs: Boolean(impressora.possuiCfs),
      slots: (impressora.slots ?? (impressora.idMaterialAtual === null
        ? []
        : [{ numeroSlot: 1, idMaterial: impressora.idMaterialAtual }])).map((slot) => ({
        numeroSlot: Number(slot.numeroSlot),
        idMaterial: Number(slot.idMaterial),
      })),
      eficiencia: Number(impressora.eficiencia),
      taxaErroRecente: Number(impressora.taxaErroRecente),
      tempoParaFicarLivreHoras: Number(impressora.tempoParaFicarLivreHoras),
      capacidadeDiaHoras: Number(impressora.capacidadeDiaHoras),
      horasUsadasHoje: Number(impressora.horasUsadasHoje ?? 0),
    })) as ImpressoraOtimizacao[];

    const novasAlocacoes =
      pedidos.length > 0 && impressoras.length > 0
        ? this.otimizacao.montarFilasDiarias(
            pedidos,
            impressoras,
            horasOperadorDisponiveis,
          )
        : [];

    try {
      await this.pedidoImpressoraRepo.substituirPlanejamento(novasAlocacoes);
      console.log(`[FilaService] Concluido. ${novasAlocacoes.length} pedidos realocados.`);
      return novasAlocacoes;
    } catch (e) {
      console.error("[FilaService] Erro:", e);
      throw e;
    }
  }
}
