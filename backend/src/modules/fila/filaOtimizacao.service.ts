export interface PedidoOtimizacao {
  id: number;
  idMaterial: number;
  tempoGcodeHoras: number;
  prazoEntregaHoras: number;
  tempoMaximoEsperaHoras?: number | null;
  limiteInicioImpressao?: string | Date | null;
  criadoEm: string | Date;
  prioridadePaga: boolean;
  // Bounding box da peça (Fase 7), em mm. Opcional/nulo quando desconhecida
  // — nesse caso a checagem de compatibilidade com a mesa (Fase 20) não filtra.
  dimensaoXMm?: number | null;
  dimensaoYMm?: number | null;
  dimensaoZMm?: number | null;
}

export interface SlotFilamentoOtimizacao {
  numeroSlot: number;
  idMaterial: number;
}

export interface ImpressoraOtimizacao {
  id: number;
  idMaterialAtual: number | null;
  possuiCfs?: boolean;
  slots?: SlotFilamentoOtimizacao[];
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
  horasUsadasHoje?: number;
  // Mesa física (Fase 20), em mm. Opcional/nula quando desconhecida — nesse
  // caso a impressora nunca é descartada por incompatibilidade de tamanho.
  larguraMesaMm?: number | null;
  profundidadeMesaMm?: number | null;
}

export type StatusInicialAlocacao = "na_fila" | "aguardando_filamento";

export interface AlocacaoPlanejada {
  idPedido: number;
  idImpressora: number;
  posicaoFila: number;
  numeroSlotPlanejado: number | null;
  requerTrocaManual: boolean;
  statusInicial: StatusInicialAlocacao;
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
export const PESO_ATRASO_PRIORIDADE_PAGA = 2;

const EPSILON_HORAS = 0.0001;

// Mantem as duracoes manuais historicamente usadas pela heuristica. Quando o
// material ja esta em um slot elegivel, nenhum desses tempos e aplicado: a
// troca automatica do CFS nao recebe uma duracao inventada.
const SETUP_MANUAL_CARREGAR_SLOT_VAZIO_HORAS = 0.25;
const SETUP_MANUAL_TROCAR_FILAMENTO_HORAS = 0.5;

type EstadoImpressora = Omit<ImpressoraOtimizacao, "possuiCfs" | "slots"> & {
  possuiCfs: boolean;
  slots: SlotFilamentoOtimizacao[];
  proximaPosicaoFila: number;
  limitePlanejamentoHoras: number;
};

interface CandidatoAlocacao {
  impressora: EstadoImpressora;
  numeroSlotPlanejado: number | null;
  requerTrocaManual: boolean;
  statusInicial: StatusInicialAlocacao;
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

      while (posicaoAtual > 0 && !sequencia[posicaoAtual - 1].prioridadePaga) {
        const pedidoUltrapassado = sequencia[posicaoAtual - 1];
        const candidata = [...sequencia];
        candidata[posicaoAtual - 1] = sequencia[posicaoAtual];
        candidata[posicaoAtual] = pedidoUltrapassado;

        if (
          !this.ultrapassagemViavel(
            sequencia,
            candidata,
            impressoras,
            horasOperadorDisponiveis,
          )
        ) {
          break;
        }

        sequencia = candidata;
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
        numeroSlotPlanejado: melhorCandidato.numeroSlotPlanejado,
        requerTrocaManual: melhorCandidato.requerTrocaManual,
        statusInicial: melhorCandidato.statusInicial,
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

      impressora.proximaPosicaoFila += 1;
      if (melhorCandidato.statusInicial === "na_fila") {
        impressora.tempoParaFicarLivreHoras = melhorCandidato.conclusaoPrevistaHoras;
        impressora.idMaterialAtual = pedido.idMaterial;
        horasOperadorRestantes = Math.max(0, horasOperadorRestantes - melhorCandidato.setup);
      }
    }

    return {
      alocacoes,
      pedidosNaoAlocados,
      custoTotal: alocacoes.reduce((total, alocacao) => total + alocacao.custo, 0),
    };
  }

  private ultrapassagemViavel(
    sequenciaAtual: PedidoOtimizacao[],
    sequenciaCandidata: PedidoOtimizacao[],
    impressoras: ImpressoraOtimizacao[],
    horasOperadorDisponiveis: number,
  ): boolean {
    const opcoesSemNovasUltrapassagens = {
      preservarOrdem: true,
      aplicarUltrapassagensCondicionadas: false,
    } as const;
    const resultadoAtual = this.simularFilasDiarias(
      sequenciaAtual,
      impressoras,
      horasOperadorDisponiveis,
      opcoesSemNovasUltrapassagens,
    );
    const resultadoCandidato = this.simularFilasDiarias(
      sequenciaCandidata,
      impressoras,
      horasOperadorDisponiveis,
      opcoesSemNovasUltrapassagens,
    );

    const alocacoesAtuais = new Map(
      resultadoAtual.alocacoes.map((alocacao) => [alocacao.idPedido, alocacao]),
    );
    const alocacoesCandidatas = new Map(
      resultadoCandidato.alocacoes.map((alocacao) => [alocacao.idPedido, alocacao]),
    );

    // A preferencia paga nunca pode criar uma violacao temporal que nao existia
    // no plano imediatamente anterior. Em sobrecarga, uma violacao que ja era
    // inevitavel pode permanecer, mas passa a ser decidida pelo atraso ponderado.
    for (const pedido of sequenciaAtual) {
      const alocacaoAtual = alocacoesAtuais.get(pedido.id);
      const alocacaoCandidata = alocacoesCandidatas.get(pedido.id);

      if (alocacaoAtual && !alocacaoCandidata) {
        return false;
      }
      if (!alocacaoAtual || !alocacaoCandidata) continue;

      if (
        (!this.alocacaoViolaTempoMaximoEspera(alocacaoAtual, pedido) &&
          this.alocacaoViolaTempoMaximoEspera(alocacaoCandidata, pedido)) ||
        (!this.alocacaoViolaPrazo(alocacaoAtual, pedido) &&
          this.alocacaoViolaPrazo(alocacaoCandidata, pedido))
      ) {
        return false;
      }
    }

    const haSobrecargaAtual = sequenciaAtual.some((pedido) => {
      const alocacao = alocacoesAtuais.get(pedido.id);
      return (
        !alocacao ||
        this.alocacaoViolaTempoMaximoEspera(alocacao, pedido) ||
        this.alocacaoViolaPrazo(alocacao, pedido)
      );
    });

    if (!haSobrecargaAtual) return true;

    if (alocacoesCandidatas.size > alocacoesAtuais.size) return true;

    const atrasoAtual = this.calcularAtrasoPonderado(resultadoAtual, sequenciaAtual);
    const atrasoCandidato = this.calcularAtrasoPonderado(
      resultadoCandidato,
      sequenciaCandidata,
    );

    return (
      Number.isFinite(atrasoCandidato) &&
      atrasoCandidato - atrasoAtual <= EPSILON_HORAS
    );
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

      if (
        candidato.statusInicial === "na_fila" &&
        candidato.conclusaoPrevistaHoras > impressora.limitePlanejamentoHoras
      ) {
        continue;
      }

      if (
        candidato.statusInicial === "na_fila" &&
        candidato.setup > horasOperadorRestantes
      ) {
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
    if (!this.cabeNaMesa(pedido, impressora)) {
      return null;
    }

    const taxaErro = this.normalizarTaxaErro(impressora.taxaErroRecente);
    const tempoReal = pedido.tempoGcodeHoras / impressora.eficiencia;
    const material = this.resolverMaterialPlanejado(pedido.idMaterial, impressora);
    const setup = material.setupManualHoras;
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
    const pesoAtraso = pedido.prioridadePaga ? PESO_ATRASO_PRIORIDADE_PAGA : 1;
    const custo =
      pesoAtraso * atrasoHoras +
      ALPHA_SETUP * setup +
      BETA_RISCO * riscoEsperado;

    return {
      impressora,
      numeroSlotPlanejado: material.numeroSlotPlanejado,
      requerTrocaManual: material.requerTrocaManual,
      statusInicial: material.statusInicial,
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

  /**
   * Fase 20: uma peça maior que a mesa nunca pode virar candidata, em nenhuma
   * das duas orientações XY (rotação em Z é permitida; altura não gira).
   * Quando a peça ou a mesa têm dimensão desconhecida, não filtra — a
   * ausência de dado nunca é tratada como incompatibilidade.
   */
  private cabeNaMesa(pedido: PedidoOtimizacao, impressora: EstadoImpressora): boolean {
    const largura = impressora.larguraMesaMm;
    const profundidade = impressora.profundidadeMesaMm;
    if (largura == null || profundidade == null || largura <= 0 || profundidade <= 0) {
      return true;
    }

    const x = pedido.dimensaoXMm;
    const y = pedido.dimensaoYMm;
    if (x == null || y == null || x <= 0 || y <= 0) {
      return true;
    }

    const cabeSemGirar = x <= largura && y <= profundidade;
    const cabeGirado = x <= profundidade && y <= largura;
    return cabeSemGirar || cabeGirado;
  }

  private resolverMaterialPlanejado(
    idMaterialPedido: number,
    impressora: EstadoImpressora,
  ): {
    numeroSlotPlanejado: number | null;
    requerTrocaManual: boolean;
    statusInicial: StatusInicialAlocacao;
    setupManualHoras: number;
  } {
    const slotEncontrado = impressora.slots.find(
      (slot) => slot.idMaterial === idMaterialPedido,
    );

    if (slotEncontrado) {
      return {
        numeroSlotPlanejado: slotEncontrado.numeroSlot,
        requerTrocaManual: false,
        statusInicial: "na_fila",
        setupManualHoras: 0,
      };
    }

    return {
      numeroSlotPlanejado: null,
      requerTrocaManual: true,
      statusInicial: "aguardando_filamento",
      setupManualHoras:
        new Set(impressora.slots.map((slot) => slot.numeroSlot)).size <
        (impressora.possuiCfs ? 4 : 1)
          ? SETUP_MANUAL_CARREGAR_SLOT_VAZIO_HORAS
          : SETUP_MANUAL_TROCAR_FILAMENTO_HORAS,
    };
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
    // Um candidato executavel sempre precede uma alocacao que depende de uma
    // intervencao sem data conhecida. A espera so e escolhida quando nenhuma
    // impressora possui o material em um slot elegivel.
    if (a.statusInicial !== b.statusInicial) {
      return a.statusInicial === "na_fila" ? -1 : 1;
    }

    if (a.violouTempoMaximoEspera !== b.violouTempoMaximoEspera) {
      return a.violouTempoMaximoEspera ? 1 : -1;
    }

    if (a.violouPrazo !== b.violouPrazo) {
      return a.violouPrazo ? 1 : -1;
    }

    if (a.custo !== b.custo) {
      return a.custo - b.custo;
    }

    if (a.requerTrocaManual !== b.requerTrocaManual) {
      return a.requerTrocaManual ? 1 : -1;
    }

    if (a.conclusaoPrevistaHoras !== b.conclusaoPrevistaHoras) {
      return a.conclusaoPrevistaHoras - b.conclusaoPrevistaHoras;
    }

    return a.impressora.id - b.impressora.id;
  }

  private calcularAtrasoPonderado(
    resultado: ResultadoSimulacaoFila,
    pedidos: PedidoOtimizacao[],
  ): number {
    const alocacoes = new Map(
      resultado.alocacoes.map((alocacao) => [alocacao.idPedido, alocacao]),
    );
    let total = 0;

    for (const pedido of pedidos) {
      const alocacao = alocacoes.get(pedido.id);
      if (!alocacao) continue;
      total +=
        alocacao.atrasoHoras *
        (pedido.prioridadePaga ? PESO_ATRASO_PRIORIDADE_PAGA : 1);
    }

    return total;
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
    // Sem fallback: um pedido sem prazoEntregaHoras válido não recebe um
    // prazo inventado (24h ou qualquer outro). A verificação de
    // Number.isFinite abaixo descarta silenciosamente o registro inválido —
    // ele já deveria ter sido barrado antes de chegar em 'na_fila'.
    const normalizado: PedidoOtimizacao = {
      id: Number(pedido.id),
      idMaterial: Number(pedido.idMaterial),
      tempoGcodeHoras,
      prazoEntregaHoras: Number(pedido.prazoEntregaHoras),
      tempoMaximoEsperaHoras: this.normalizarNumeroOpcional(
        pedido.tempoMaximoEsperaHoras,
      ),
      limiteInicioImpressao: pedido.limiteInicioImpressao ?? null,
      criadoEm: pedido.criadoEm,
      prioridadePaga: this.normalizarBooleano(pedido.prioridadePaga),
      dimensaoXMm: this.normalizarNumeroOpcional(pedido.dimensaoXMm),
      dimensaoYMm: this.normalizarNumeroOpcional(pedido.dimensaoYMm),
      dimensaoZMm: this.normalizarNumeroOpcional(pedido.dimensaoZMm),
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

    const possuiCfs = this.normalizarBooleano(impressora.possuiCfs);
    const slotsOriginais = Array.isArray(impressora.slots)
      ? impressora.slots
      : idMaterialAtual === null
        ? []
        : [{ numeroSlot: 1, idMaterial: idMaterialAtual }];
    const slots = slotsOriginais
      .map((slot) => ({
        numeroSlot: Number(slot.numeroSlot),
        idMaterial: Number(slot.idMaterial),
      }))
      .filter(
        (slot) =>
          Number.isInteger(slot.numeroSlot) &&
          slot.numeroSlot >= 1 &&
          slot.numeroSlot <= 4 &&
          Number.isFinite(slot.idMaterial) &&
          (!possuiCfs ? slot.numeroSlot === 1 : true),
      )
      .sort((a, b) => a.numeroSlot - b.numeroSlot);

    const normalizada: EstadoImpressora = {
      id: Number(impressora.id),
      idMaterialAtual,
      possuiCfs,
      slots,
      eficiencia: this.normalizarNumeroPositivo(impressora.eficiencia, 1),
      taxaErroRecente: this.normalizarTaxaErro(impressora.taxaErroRecente),
      tempoParaFicarLivreHoras: Math.max(
        0,
        this.normalizarNumero(impressora.tempoParaFicarLivreHoras, 0),
      ),
      capacidadeDiaHoras: this.normalizarNumeroPositivo(impressora.capacidadeDiaHoras, 8),
      horasUsadasHoje: Math.max(0, this.normalizarNumero(impressora.horasUsadasHoje, 0)),
      limitePlanejamentoHoras: Math.max(
        0,
        this.normalizarNumeroPositivo(impressora.capacidadeDiaHoras, 8) -
          Math.max(0, this.normalizarNumero(impressora.horasUsadasHoje, 0)),
      ),
      proximaPosicaoFila: 1,
      larguraMesaMm: this.normalizarNumeroOpcional(impressora.larguraMesaMm),
      profundidadeMesaMm: this.normalizarNumeroOpcional(impressora.profundidadeMesaMm),
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
