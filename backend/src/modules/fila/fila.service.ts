import { db } from "../../database/connection";
import { ImpressoraRepository } from "../impressoras/impressoras.repository";
import { PedidoRepository } from "../pedidos/pedidos.repository";
import {
  AlocacaoPlanejada,
  FilaOtimizacaoService,
  ImpressoraOtimizacao,
  PedidoOtimizacao,
} from "./filaOtimizacao.service";

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
      eficiencia: Number(impressora.eficiencia),
      taxaErroRecente: Number(impressora.taxaErroRecente),
      tempoParaFicarLivreHoras: Number(impressora.tempoParaFicarLivreHoras),
      capacidadeDiaHoras: Number(impressora.capacidadeDiaHoras),
    })) as ImpressoraOtimizacao[];

    const novasAlocacoes =
      pedidos.length > 0 && impressoras.length > 0
        ? this.otimizacao.montarFilasDiarias(
            pedidos,
            impressoras,
            horasOperadorDisponiveis,
          )
        : [];

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      await conn.execute("DELETE FROM pedido_impressora WHERE status = 'na_fila'");

      for (const alocacao of novasAlocacoes) {
        await conn.execute(
          `
          INSERT INTO pedido_impressora (
            id_pedido,
            id_impressora,
            status,
            posicao_fila,
            inicio_previsto_horas,
            conclusao_prevista_horas,
            custo,
            setup_horas,
            risco_esperado_horas,
            tempo_total_horas,
            atraso_horas
          )
          VALUES (?, ?, 'na_fila', ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            alocacao.idPedido,
            alocacao.idImpressora,
            alocacao.posicaoFila,
            alocacao.inicioPrevistoHoras,
            alocacao.conclusaoPrevistaHoras,
            alocacao.custo,
            alocacao.setupHoras,
            alocacao.riscoEsperadoHoras,
            alocacao.tempoTotalHoras,
            alocacao.atrasoHoras,
          ],
        );
      }

      await conn.commit();
      console.log(`[FilaService] Concluido. ${novasAlocacoes.length} pedidos realocados.`);
      return novasAlocacoes;
    } catch (e) {
      await conn.rollback();
      console.error("[FilaService] Erro:", e);
      throw e;
    } finally {
      conn.release();
    }
  }
}
