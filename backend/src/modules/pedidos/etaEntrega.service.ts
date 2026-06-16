import {
  ImpressoraOtimizacaoRow,
  ImpressoraRepository,
} from "../impressoras/impressoras.repository";
import { PedidoOtimizacaoRow, PedidoRepository } from "./pedidos.repository";

const ETA_BUFFER_PERCENTUAL_PADRAO = 0.2;
const FATOR_INTERFERENCIA_PRIORIDADE_PADRAO = 0.1;
const JORNADA_INICIO_HORA_PADRAO = 8;
const JORNADA_HORAS_DIA_PADRAO = 8;
const SETUP_MEDIO_FARM_HORAS_PADRAO = 0.3;

export interface CalcularEtaPedidoInput {
  idMaterial: number;
  tempoGcodeHoras: number;
  prioridadePaga?: boolean;
}

export interface MetricasFarm {
  eficienciaFarm: number;
  taxaErroFarm: number;
  setupFarmHoras: number;
  capacidadeDiariaTotal: number;
  jornadaHorasDia: number;
}

export interface ResultadoEtaEntrega {
  prazoEntregaHoras: number;
  prazoEntrega: string;
  prazoEntregaOriginal: string;
  limiteInicioImpressao: string;
  etaHorasEstimado: number;
  etaCalculadoEm: string;
  tempoMaximoEsperaHoras: number;
  bufferPrioridadeHoras: number;
  bufferSegurancaHoras: number;
  tempoExecFarmHoras: number;
}

function normalizarNumeroPositivo(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function normalizarPercentual(value: unknown, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function limitarTaxaErro(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.min(parsed, 0.95));
}

function formatarDataMysql(data: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())} ${pad(
    data.getHours(),
  )}:${pad(data.getMinutes())}:${pad(data.getSeconds())}`;
}

export function adicionarHorasUteis(
  dataInicial: Date,
  horasUteis: number,
  horaInicioExpediente = JORNADA_INICIO_HORA_PADRAO,
  horasPorDia = JORNADA_HORAS_DIA_PADRAO,
): Date {
  const horasRestantesNormalizadas = Math.max(0, Number(horasUteis) || 0);
  const inicioHora = Math.max(0, Math.min(23, Math.floor(horaInicioExpediente)));
  const duracaoDia = Math.min(
    24 - inicioHora,
    normalizarNumeroPositivo(horasPorDia, JORNADA_HORAS_DIA_PADRAO),
  );
  const fimHora = inicioHora + duracaoDia;
  let horasRestantes = horasRestantesNormalizadas;
  const cursor = new Date(dataInicial);

  const moverParaInicioDoDia = () => {
    cursor.setHours(inicioHora, 0, 0, 0);
  };

  const moverParaProximoDia = () => {
    cursor.setDate(cursor.getDate() + 1);
    moverParaInicioDoDia();
  };

  const horaDecimalAtual = () =>
    cursor.getHours() + cursor.getMinutes() / 60 + cursor.getSeconds() / 3600;

  if (horaDecimalAtual() < inicioHora) {
    moverParaInicioDoDia();
  } else if (horaDecimalAtual() >= fimHora) {
    moverParaProximoDia();
  }

  while (horasRestantes > 0) {
    const horasDisponiveisHoje = Math.max(0, fimHora - horaDecimalAtual());

    if (horasDisponiveisHoje === 0) {
      moverParaProximoDia();
      continue;
    }

    const horasConsumidas = Math.min(horasRestantes, horasDisponiveisHoje);
    cursor.setTime(cursor.getTime() + horasConsumidas * 60 * 60 * 1000);
    horasRestantes -= horasConsumidas;

    if (horasRestantes > 0) {
      moverParaProximoDia();
    }
  }

  return cursor;
}

export class EtaEntregaService {
  constructor(
    private readonly pedidoRepository: PedidoRepository,
    private readonly impressoraRepository: ImpressoraRepository,
  ) {}

  async calcularParaNovoPedido(data: CalcularEtaPedidoInput): Promise<ResultadoEtaEntrega> {
    const pedidosPendentes = await this.pedidoRepository.findPendentesParaOtimizacao();
    const impressoras = await this.impressoraRepository.findParaOtimizacao();

    return this.calcularEtaNovoPedido(data, pedidosPendentes, impressoras);
  }

  calcularMetricasFarm(impressoras: ImpressoraOtimizacaoRow[]): MetricasFarm {
    const eficienciaValidas = impressoras
      .map((impressora) => Number(impressora.eficiencia))
      .filter((eficiencia) => Number.isFinite(eficiencia) && eficiencia > 0);
    const taxasErro = impressoras.map((impressora) => limitarTaxaErro(impressora.taxaErroRecente));
    const capacidadeDiariaTotal = impressoras.reduce((total, impressora) => {
      const capacidade = Number(impressora.capacidadeDiaHoras);
      return total + (Number.isFinite(capacidade) && capacidade > 0 ? capacidade : 0);
    }, 0);

    if (capacidadeDiariaTotal <= 0) {
      throw new Error(
        "Nao foi possivel calcular o prazo de entrega: nenhuma impressora disponivel ou capacidade insuficiente.",
      );
    }

    const eficienciaFarm =
      eficienciaValidas.length > 0
        ? eficienciaValidas.reduce((total, eficiencia) => total + eficiencia, 0) /
          eficienciaValidas.length
        : 1;
    const taxaErroFarm =
      taxasErro.length > 0
        ? taxasErro.reduce((total, taxa) => total + taxa, 0) / taxasErro.length
        : 0;

    return {
      eficienciaFarm: eficienciaFarm > 0 ? eficienciaFarm : 1,
      taxaErroFarm: limitarTaxaErro(taxaErroFarm),
      setupFarmHoras: normalizarNumeroPositivo(
        process.env.SETUP_MEDIO_FARM_HORAS,
        SETUP_MEDIO_FARM_HORAS_PADRAO,
      ),
      capacidadeDiariaTotal,
      jornadaHorasDia: normalizarNumeroPositivo(
        process.env.JORNADA_HORAS_DIA,
        JORNADA_HORAS_DIA_PADRAO,
      ),
    };
  }

  calcularTempoExecFarm(
    pedido: Pick<CalcularEtaPedidoInput | PedidoOtimizacaoRow, "tempoGcodeHoras">,
    metricasFarm: MetricasFarm,
  ): number {
    const tempoGcodeHoras = Number(pedido.tempoGcodeHoras);

    if (!Number.isFinite(tempoGcodeHoras) || tempoGcodeHoras <= 0) {
      throw new Error("tempoGcodeHoras e obrigatorio e deve ser maior que zero.");
    }

    return (
      (tempoGcodeHoras / metricasFarm.eficienciaFarm + metricasFarm.setupFarmHoras) /
      (1 - metricasFarm.taxaErroFarm)
    );
  }

  calcularWorkloadPendente(
    pedidosPendentes: PedidoOtimizacaoRow[],
    metricasFarm: MetricasFarm,
  ): number {
    return pedidosPendentes.reduce(
      (total, pedido) => total + this.calcularTempoExecFarm(pedido, metricasFarm),
      0,
    );
  }

  calcularBufferPrioridade(tempoFilaHoras: number, prioridadePaga?: boolean): number {
    if (prioridadePaga) {
      return 0;
    }

    const fator = normalizarPercentual(
      process.env.FATOR_INTERFERENCIA_PRIORIDADE,
      FATOR_INTERFERENCIA_PRIORIDADE_PADRAO,
    );

    return tempoFilaHoras * fator;
  }

  calcularEtaNovoPedido(
    data: CalcularEtaPedidoInput,
    pedidosPendentes: PedidoOtimizacaoRow[],
    impressoras: ImpressoraOtimizacaoRow[],
    dataBase = new Date(),
  ): ResultadoEtaEntrega {
    const metricasFarm = this.calcularMetricasFarm(impressoras);
    const tempoExecFarmHoras = this.calcularTempoExecFarm(data, metricasFarm);
    const workloadPendente = this.calcularWorkloadPendente(pedidosPendentes, metricasFarm);
    const tempoFilaHoras =
      (workloadPendente / metricasFarm.capacidadeDiariaTotal) * metricasFarm.jornadaHorasDia;
    const bufferPrioridadeHoras = this.calcularBufferPrioridade(
      tempoFilaHoras,
      data.prioridadePaga,
    );
    const etaParcial = tempoFilaHoras + tempoExecFarmHoras + bufferPrioridadeHoras;
    const bufferSegurancaHoras =
      etaParcial *
      normalizarPercentual(process.env.ETA_BUFFER_PERCENTUAL, ETA_BUFFER_PERCENTUAL_PADRAO);
    const etaHorasEstimado = etaParcial + bufferSegurancaHoras;
    const tempoMaximoEsperaHoras = Math.max(0, etaHorasEstimado - tempoExecFarmHoras);
    const limiteInicioImpressao = adicionarHorasUteis(
      dataBase,
      tempoMaximoEsperaHoras,
      normalizarNumeroPositivo(process.env.JORNADA_INICIO_HORA, JORNADA_INICIO_HORA_PADRAO),
      metricasFarm.jornadaHorasDia,
    );
    const prazoEntrega = adicionarHorasUteis(
      dataBase,
      etaHorasEstimado,
      normalizarNumeroPositivo(process.env.JORNADA_INICIO_HORA, JORNADA_INICIO_HORA_PADRAO),
      metricasFarm.jornadaHorasDia,
    );
    const prazoEntregaFormatado = formatarDataMysql(prazoEntrega);
    const limiteInicioImpressaoFormatado = formatarDataMysql(limiteInicioImpressao);
    const etaCalculadoEm = formatarDataMysql(dataBase);

    return {
      prazoEntregaHoras: etaHorasEstimado,
      prazoEntrega: prazoEntregaFormatado,
      prazoEntregaOriginal: prazoEntregaFormatado,
      limiteInicioImpressao: limiteInicioImpressaoFormatado,
      etaHorasEstimado,
      etaCalculadoEm,
      tempoMaximoEsperaHoras,
      bufferPrioridadeHoras,
      bufferSegurancaHoras,
      tempoExecFarmHoras,
    };
  }
}
