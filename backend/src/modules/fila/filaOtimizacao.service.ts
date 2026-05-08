export interface PedidoOtimizacao {
  id: number;
  idMaterial: number;
  tempoGcodeHoras: number;
  prazoEntregaHoras: number;
  tempoMaximoEsperaHoras?: number | null;
  limiteInicioImpressao?: string | Date | null;
  criadoEm: string | Date;
  prioridadePaga: boolean;
}

export interface ImpressoraOtimizacao {
  id: number;
  idMaterialAtual: number | null;
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
}

export interface AlocacaoPlanejada {
  idPedido: number;
  idImpressora: number;
  posicaoFila: number;
  inicioPrevistoHoras: number;
  conclusaoPrevistaHoras: number;
  custo: number;
  setupHoras: number;
  riscoEsperadoHoras: number;
  tempoTotalHoras: number;
  atrasoHoras: number;
  violouPrazo: boolean;
  violouTempoMaximoEspera: boolean;
}

export interface ResultadoSimulacaoFila {
  alocacoes: AlocacaoPlanejada[];
  pedidosNaoAlocados: PedidoOtimizacao[];
  custoTotal: number;
}

export interface OpcoesSimulacaoFila {
  preservarOrdem?: boolean;
  aplicarUltrapassagensCondicionadas?: boolean;
}

export const ALPHA_SETUP = 1;
export const BETA_RISCO = 1;

const EPSILON_HORAS = 0.0001;

interface EstadoImpressora extends ImpressoraOtimizacao {
  proximaPosicaoFila: number;
}

interface CandidatoAlocacao {
  impressora: EstadoImpressora;
  inicioPrevistoHoras: number;
  conclusaoPrevistaHoras: number;
  setup: number;
  riscoEsperado: number;
  tempoTotal: number;
  atrasoHoras: number;
  violouPrazo: boolean;
  violouTempoMaximoEspera: boolean;
  custo: number;
}

export class FilaOtimizacaoService {
  montarFilasDiarias(
    pedidos: PedidoOtimizacao[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
  ): AlocacaoPlanejada[] {
    return this.simularFilasDiarias(pedidos, impressoras, horasOperadorDisponiveis, {
      aplicarUltrapassagensCondicionadas: true,
    }).alocacoes;
  }

  simularFilasDiarias(
    pedidos: PedidoOtimizacao[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
    opcoes: OpcoesSimulacaoFila = {},
  ): ResultadoSimulacaoFila {
    const pedidosNormalizados = pedidos
      .map((pedido) => this.normalizarPedido(pedido))
      .filter((pedido): pedido is PedidoOtimizacao => pedido !== null);
    const pedidosBase = opcoes.preservarOrdem
      ? pedidosNormalizados
      : this.ordenarFifo(pedidosNormalizados);
    const deveAplicarUltrapassagens =
      opcoes.aplicarUltrapassagensCondicionadas ?? !opcoes.preservarOrdem;
    const pedidosSequenciados = deveAplicarUltrapassagens
      ? this.aplicarUltrapassagensCondicionadas(
          pedidosBase,
          impressoras,
          horasOperadorDisponiveis,
        )
      : pedidosBase;

    return this.simularSequencia(pedidosSequenciados, impressoras, horasOperadorDisponiveis);
  }

  ordenarFifo(pedidos: PedidoOtimizacao[]): PedidoOtimizacao[] {
    return [...pedidos].sort((a, b) => {
      const dataA = this.normalizarTimestamp(a.criadoEm);
      const dataB = this.normalizarTimestamp(b.criadoEm);

      if (dataA !== dataB) {
        return dataA - dataB;
      }

      return a.id - b.id;
    });
  }

  aplicarUltrapassagensCondicionadas(
    pedidos: PedidoOtimizacao[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
  ): PedidoOtimizacao[] {
    let sequencia = this.ordenarFifo(pedidos);

    for (let indice = 0; indice < sequencia.length; indice += 1) {
      if (!sequencia[indice].prioridadePaga) {
        continue;
      }

      let posicaoAtual = indice;
      const idsPedidosUltrapassados: number[] = [];

      while (posicaoAtual > 0 && !sequencia[posicaoAtual - 1].prioridadePaga) {
        const pedidoUltrapassado = sequencia[posicaoAtual - 1];
        const idsAfetados = [...idsPedidosUltrapassados, pedidoUltrapassado.id];
        const candidata = [...sequencia];
        candidata[posicaoAtual - 1] = sequencia[posicaoAtual];
        candidata[posicaoAtual] = pedidoUltrapassado;

        if (
          !this.ultrapassagemViavel(
            candidata,
            idsAfetados,
            impressoras,
            horasOperadorDisponiveis,
          )
        ) {
          break;
        }

        sequencia = candidata;
        idsPedidosUltrapassados.push(pedidoUltrapassado.id);
        posicaoAtual -= 1;
      }
    }

    return sequencia;
  }

  private simularSequencia(
    pedidosSequenciados: PedidoOtimizacao[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
  ): ResultadoSimulacaoFila {
    const estadosImpressoras = impressoras
      .map((impressora) => this.normalizarImpressora(impressora))
      .filter((impressora): impressora is EstadoImpressora => impressora !== null);
    const alocacoes: AlocacaoPlanejada[] = [];
    const pedidosNaoAlocados: PedidoOtimizacao[] = [];
    let horasOperadorRestantes = Math.max(0, Number(horasOperadorDisponiveis) || 0);

    for (const pedido of pedidosSequenciados) {
      const melhorCandidato = this.encontrarMelhorCandidato(
        pedido,
        estadosImpressoras,
        horasOperadorRestantes,
      );

      if (!melhorCandidato) {
        pedidosNaoAlocados.push(pedido);
        continue;
      }

      const { impressora } = melhorCandidato;
      const posicaoFila = impressora.proximaPosicaoFila;

      alocacoes.push({
        idPedido: pedido.id,
        idImpressora: impressora.id,
        posicaoFila,
        inicioPrevistoHoras: melhorCandidato.inicioPrevistoHoras,
        conclusaoPrevistaHoras: melhorCandidato.conclusaoPrevistaHoras,
        custo: melhorCandidato.custo,
        setupHoras: melhorCandidato.setup,
        riscoEsperadoHoras: melhorCandidato.riscoEsperado,
        tempoTotalHoras: melhorCandidato.tempoTotal,
        atrasoHoras: melhorCandidato.atrasoHoras,
        violouPrazo: melhorCandidato.violouPrazo,
        violouTempoMaximoEspera: melhorCandidato.violouTempoMaximoEspera,
      });

      impressora.tempoParaFicarLivreHoras = melhorCandidato.conclusaoPrevistaHoras;
      impressora.idMaterialAtual = pedido.idMaterial;
      impressora.proximaPosicaoFila += 1;
      horasOperadorRestantes -= melhorCandidato.setup;
    }

    return {
      alocacoes,
      pedidosNaoAlocados,
      custoTotal: alocacoes.reduce((total, alocacao) => total + alocacao.custo, 0),
    };
  }

  private ultrapassagemViavel(
    sequenciaCandidata: PedidoOtimizacao[],
    _idsPedidosUltrapassados: number[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
  ): boolean {
    const resultado = this.simularFilasDiarias(
      sequenciaCandidata,
      impressoras,
      horasOperadorDisponiveis,
      {
        preservarOrdem: true,
        aplicarUltrapassagensCondicionadas: false,
      },
    );

    // Regra conservadora: uma troca de prioridade so e aceita se nenhum pedido
    // normal da simulacao passar a violar seu limite de inicio ou seu prazo.
    const pedidosNormais = sequenciaCandidata.filter((pedido) => !pedido.prioridadePaga);

    for (const pedido of pedidosNormais) {
      const alocacao = resultado.alocacoes.find((item) => item.idPedido === pedido.id);

      if (!alocacao) {
        return false;
      }

      if (
        this.alocacaoViolaTempoMaximoEspera(alocacao, pedido) ||
        this.alocacaoViolaPrazo(alocacao, pedido)
      ) {
        return false;
      }
    }

    return true;
  }

  private encontrarMelhorCandidato(
    pedido: PedidoOtimizacao,
    impressoras: EstadoImpressora[],
    horasOperadorRestantes: number,
  ): CandidatoAlocacao | null {
    let melhorCandidato: CandidatoAlocacao | null = null;

    for (const impressora of impressoras) {
      const candidato = this.calcularCandidato(pedido, impressora);

      if (!candidato) {
        continue;
      }

      if (candidato.conclusaoPrevistaHoras > impressora.capacidadeDiaHoras) {
        continue;
      }

      if (candidato.setup > horasOperadorRestantes) {
        continue;
      }

      if (!melhorCandidato || this.compararCandidatos(candidato, melhorCandidato) < 0) {
        melhorCandidato = candidato;
      }
    }

    return melhorCandidato;
  }

  private calcularCandidato(
    pedido: PedidoOtimizacao,
    impressora: EstadoImpressora,
  ): CandidatoAlocacao | null {
    if (impressora.eficiencia <= 0) {
      return null;
    }

    const taxaErro = this.normalizarTaxaErro(impressora.taxaErroRecente);
    const tempoReal = pedido.tempoGcodeHoras / impressora.eficiencia;
    const setup = this.calcularSetup(pedido.idMaterial, impressora.idMaterialAtual);
    const tempoBase = tempoReal + setup;
    const tempoTotal = tempoBase / (1 - taxaErro);
    const riscoEsperado = tempoTotal - tempoBase;
    const inicioPrevistoHoras = impressora.tempoParaFicarLivreHoras;
    const conclusaoPrevistaHoras = inicioPrevistoHoras + tempoTotal;
    const atrasoHoras = this.calcularAtrasoHoras(conclusaoPrevistaHoras, pedido);
    const violouPrazo = this.alocacaoViolaPrazo({ conclusaoPrevistaHoras }, pedido);
    const violouTempoMaximoEspera = this.alocacaoViolaTempoMaximoEspera(
      { inicioPrevistoHoras },
      pedido,
    );
    const custo = atrasoHoras + ALPHA_SETUP * setup + BETA_RISCO * riscoEsperado;

    return {
      impressora,
      inicioPrevistoHoras,
      conclusaoPrevistaHoras,
      setup,
      riscoEsperado,
      tempoTotal,
      atrasoHoras,
      violouPrazo,
      violouTempoMaximoEspera,
      custo,
    };
  }

  private calcularSetup(idMaterialPedido: number, idMaterialAtual: number | null): number {
    if (idMaterialAtual === idMaterialPedido) {
      return 0.15;
    }

    if (idMaterialAtual === null) {
      return 0.25;
    }

    return 0.5;
  }

  private normalizarTimestamp(data: string | Date): number {
    const timestamp = new Date(data).getTime();
    return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
  }

  private normalizarBooleano(value: unknown): boolean {
    return value === true || value === 1 || value === "1" || value === "true";
  }

  private normalizarTaxaErro(value: unknown): number {
    const taxa = Number(value);

    if (!Number.isFinite(taxa)) {
      return 0;
    }

    return Math.max(0, Math.min(taxa, 0.95));
  }

  private normalizarNumeroPositivo(value: unknown, fallback: number): number {
    const numero = Number(value);
    return Number.isFinite(numero) && numero > 0 ? numero : fallback;
  }

  private normalizarNumero(value: unknown, fallback: number): number {
    const numero = Number(value);
    return Number.isFinite(numero) ? numero : fallback;
  }

  private normalizarNumeroOpcional(value: unknown): number | null {
    if (value === null || value === undefined || value === "") {
      return null;
    }

    const numero = Number(value);
    return Number.isFinite(numero) ? numero : null;
  }

  private compararCandidatos(a: CandidatoAlocacao, b: CandidatoAlocacao): number {
    if (a.violouTempoMaximoEspera !== b.violouTempoMaximoEspera) {
      return a.violouTempoMaximoEspera ? 1 : -1;
    }

    if (a.violouPrazo !== b.violouPrazo) {
      return a.violouPrazo ? 1 : -1;
    }

    if (a.custo !== b.custo) {
      return a.custo - b.custo;
    }

    if (a.conclusaoPrevistaHoras !== b.conclusaoPrevistaHoras) {
      return a.conclusaoPrevistaHoras - b.conclusaoPrevistaHoras;
    }

    return a.impressora.id - b.impressora.id;
  }

  private calcularAtrasoHoras(conclusaoPrevistaHoras: number, pedido: PedidoOtimizacao): number {
    if (!Number.isFinite(pedido.prazoEntregaHoras)) {
      return 0;
    }

    return Math.max(0, conclusaoPrevistaHoras - pedido.prazoEntregaHoras);
  }

  private alocacaoViolaPrazo(
    alocacao: Pick<AlocacaoPlanejada, "conclusaoPrevistaHoras">,
    pedido: PedidoOtimizacao,
  ): boolean {
    if (!Number.isFinite(pedido.prazoEntregaHoras)) {
      return false;
    }

    return alocacao.conclusaoPrevistaHoras - pedido.prazoEntregaHoras > EPSILON_HORAS;
  }

  private alocacaoViolaTempoMaximoEspera(
    alocacao: Pick<AlocacaoPlanejada, "inicioPrevistoHoras">,
    pedido: PedidoOtimizacao,
  ): boolean {
    const tempoMaximoEsperaHoras = this.calcularTempoMaximoEsperaRestante(pedido);

    if (tempoMaximoEsperaHoras === null) {
      return false;
    }

    return alocacao.inicioPrevistoHoras - tempoMaximoEsperaHoras > EPSILON_HORAS;
  }

  private calcularTempoMaximoEsperaRestante(pedido: PedidoOtimizacao): number | null {
    const tempoMaximoEsperaHoras = this.normalizarNumeroOpcional(
      pedido.tempoMaximoEsperaHoras,
    );

    if (tempoMaximoEsperaHoras !== null) {
      return tempoMaximoEsperaHoras;
    }

    if (!pedido.limiteInicioImpressao) {
      return null;
    }

    const limite =
      pedido.limiteInicioImpressao instanceof Date
        ? pedido.limiteInicioImpressao
        : new Date(String(pedido.limiteInicioImpressao).replace(" ", "T"));
    const timestampLimite = limite.getTime();

    if (!Number.isFinite(timestampLimite)) {
      return null;
    }

    return (timestampLimite - Date.now()) / (60 * 60 * 1000);
  }

  private normalizarPedido(pedido: PedidoOtimizacao): PedidoOtimizacao | null {
    const tempoGcodeHoras = Number(pedido.tempoGcodeHoras);
    const normalizado: PedidoOtimizacao = {
      id: Number(pedido.id),
      idMaterial: Number(pedido.idMaterial),
      tempoGcodeHoras,
      prazoEntregaHoras: this.normalizarNumero(pedido.prazoEntregaHoras, 24),
      tempoMaximoEsperaHoras: this.normalizarNumeroOpcional(
        pedido.tempoMaximoEsperaHoras,
      ),
      limiteInicioImpressao: pedido.limiteInicioImpressao ?? null,
      criadoEm: pedido.criadoEm,
      prioridadePaga: this.normalizarBooleano(pedido.prioridadePaga),
    };

    if (
      !Number.isFinite(normalizado.id) ||
      !Number.isFinite(normalizado.idMaterial) ||
      !Number.isFinite(normalizado.tempoGcodeHoras) ||
      normalizado.tempoGcodeHoras <= 0 ||
      !Number.isFinite(normalizado.prazoEntregaHoras)
    ) {
      return null;
    }

    return normalizado;
  }

  private normalizarImpressora(impressora: ImpressoraOtimizacao): EstadoImpressora | null {
    const idMaterialAtual =
      impressora.idMaterialAtual === null || impressora.idMaterialAtual === undefined
        ? null
        : Number(impressora.idMaterialAtual);

    const normalizada: EstadoImpressora = {
      id: Number(impressora.id),
      idMaterialAtual,
      eficiencia: this.normalizarNumeroPositivo(impressora.eficiencia, 1),
      taxaErroRecente: this.normalizarTaxaErro(impressora.taxaErroRecente),
      tempoParaFicarLivreHoras: Math.max(
        0,
        this.normalizarNumero(impressora.tempoParaFicarLivreHoras, 0),
      ),
      capacidadeDiaHoras: this.normalizarNumeroPositivo(impressora.capacidadeDiaHoras, 8),
      proximaPosicaoFila: 1,
    };

    if (
      !Number.isFinite(normalizada.id) ||
      (normalizada.idMaterialAtual !== null && !Number.isFinite(normalizada.idMaterialAtual)) ||
      !Number.isFinite(normalizada.eficiencia) ||
      !Number.isFinite(normalizada.taxaErroRecente) ||
      !Number.isFinite(normalizada.capacidadeDiaHoras)
    ) {
      return null;
    }

    return normalizada;
  }
}
