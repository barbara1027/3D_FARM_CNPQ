import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import {
  AlocacaoPlanejada,
  FilaOtimizacaoService,
  ImpressoraOtimizacao,
  PedidoOtimizacao,
} from "./filaOtimizacao.service";
import { PedidoImpressoraRepository } from "./pedidoImpressora.repository";
import { calcularHorasOperacionaisEntre } from "../../shared/tempo/tempoOperacional";

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

    // `findPendentesParaOtimizacao` só devolve pedidos com base temporal já
    // validada (nunca null aqui), com prazo/limite como datas absolutas.
    // A conversão para horas restantes usa horas operacionais — a mesma
    // definição de jornada usada pelo EtaEntregaService — nunca horas
    // corridas (TIMESTAMPDIFF cru mediria o dia inteiro, inclusive à noite).
    const agora = new Date();
    const pedidos = pedidosBrutos.map((pedido) => ({
      id: Number(pedido.id),
      idMaterial: Number(pedido.idMaterial),
      tempoGcodeHoras: Number(pedido.tempoGcodeHoras),
      prazoEntregaHoras: calcularHorasOperacionaisEntre(
        agora,
        new Date(pedido.prazoEntrega.replace(" ", "T")),
      ),
      tempoMaximoEsperaHoras: calcularHorasOperacionaisEntre(
        agora,
        new Date(pedido.limiteInicioImpressao.replace(" ", "T")),
      ),
      limiteInicioImpressao: pedido.limiteInicioImpressao,
      criadoEm: pedido.criadoEm,
      prioridadePaga: Boolean(pedido.prioridadePaga),
      dimensaoXMm: pedido.dimensaoXMm ?? null,
      dimensaoYMm: pedido.dimensaoYMm ?? null,
      dimensaoZMm: pedido.dimensaoZMm ?? null,
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
      larguraMesaMm: impressora.larguraMesaMm ?? null,
      profundidadeMesaMm: impressora.profundidadeMesaMm ?? null,
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
