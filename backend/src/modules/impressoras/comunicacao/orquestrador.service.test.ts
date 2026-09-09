import assert from "node:assert/strict";
import { describe, it } from "node:test";
import path from "node:path";
import { ArquivoRepository } from "../../arquivos/arquivos.repository";
import {
  PedidoImpressoraRepository,
  ReservaAlocacao,
} from "../../fila/pedidoImpressora.repository";
import { Pedido, PedidoRepository } from "../../pedidos/pedidos.repository";
import { Impressora, ImpressoraRepository } from "../impressoras.repository";
import { ImpressoraOrquestradorService } from "./orquestrador.service";
import { PrinterAdapterFactory } from "./printer-adapter.factory";
import {
  CfsInventory,
  CfsPrintStartResult,
  CfsPrintSubmission,
  CfsPrintSubmissionAdapter,
  IPrinterCommunicationAdapter,
  PrinterHealthCheckResult,
  PrinterJobPayload,
  PrinterRuntimeStatus,
  PrinterStartJobResult,
} from "./tipos";

const GCODE_FIXTURE = path.resolve(
  __dirname,
  "../../../test/fixtures/cfs-monomaterial-t7.gcode",
);

const RESERVA: ReservaAlocacao = {
  idAlocacao: 501,
  idPedido: 101,
  idImpressora: 17,
  numeroSlotPlanejado: 2,
};

function criarPedido(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: RESERVA.idPedido,
    nome: "Pedido sanitizado",
    preco: 10,
    descricao: null,
    status: "na_fila",
    idUsuario: 1,
    idMaterial: 301,
    idQualidade: 1,
    idArquivo: 1,
    parametros: null,
    quantidade: 1,
    unidadesConcluidas: 0,
    gcodePath: GCODE_FIXTURE,
    tempoEstimadoS: 60,
    materialGramas: 1,
    scoreComplexidade: null,
    motivoComplexidade: null,
    motivoFalha: null,
    motivoCancelamento: null,
    precoBase: 10,
    taxaComplexidade: null,
    taxaStripe: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tempoGcodeHoras: 0.25,
    prazoEntregaHoras: 24,
    prazoEntrega: null,
    etaHorasEstimado: null,
    etaCalculadoEm: null,
    prazoEntregaOriginal: null,
    limiteInicioImpressao: null,
    prioridadePaga: false,
    tempoMaximoEsperaHoras: null,
    bufferPrioridadeHoras: null,
    bufferSegurancaHoras: null,
    tempoExecFarmHoras: null,
    dimensaoXMm: null,
    dimensaoYMm: null,
    dimensaoZMm: null,
    ...overrides,
  };
}

function criarImpressora(overrides: Partial<Impressora> = {}): Impressora {
  return {
    id: RESERVA.idImpressora,
    nome: "Impressora sanitizada",
    modelo: "Modelo CFS de teste",
    status: "Reservada",
    ip: null,
    baseUrl: null,
    api: "DUMMY",
    api_key: null,
    timeoutMs: 1_000,
    statusFisico: "reserved",
    jobRemotoId: null,
    ultimoErro: null,
    ultimaSincronizacao: null,
    possuiCfs: true,
    larguraMesaMm: 220,
    profundidadeMesaMm: 220,
    filamentosCarregados: [
      {
        numeroSlot: 2,
        material: { id: 301, nome: "PLA preto", tipo: "PLA", cor: "#000000" },
      },
    ],
    idPedidoAtual: RESERVA.idPedido,
    eficiencia: 1,
    taxaErroRecente: 0,
    tempoParaFicarLivreHoras: 0,
    capacidadeDiaHoras: 8,
    ...overrides,
  };
}

function inventarioSlot(
  numeroSlot = 2,
  overrides: Partial<CfsInventory["itens"][number]> = {},
): CfsInventory {
  return {
    itens: [
      {
        numeroSlot,
        boxId: "device-box-a",
        deviceMaterialId: `device-material-slot-${numeroSlot}`,
        tipoMaterial: "PLA",
        cor: "#000000",
        ...overrides,
      },
    ],
    consultadoEm: "2026-01-01T00:00:00.000Z",
  };
}

class FakeImpressoraRepository {
  readonly markErrorCalls: Array<{ id: number; mensagem: string }> = [];
  readonly eventCalls: Array<{ id: number; tipo: string; mensagem: string; payload?: unknown }> = [];
  readonly updateCalls: Array<{ id: number; data: Record<string, unknown> }> = [];

  constructor(readonly impressora: Impressora) {}

  async findById(id: number): Promise<Impressora | null> {
    return id === this.impressora.id
      ? {
          ...this.impressora,
          filamentosCarregados: this.impressora.filamentosCarregados.map((slot) => ({
            numeroSlot: slot.numeroSlot,
            material: { ...slot.material },
          })),
        }
      : null;
  }

  async markError(id: number, mensagem: string): Promise<void> {
    this.markErrorCalls.push({ id, mensagem });
  }

  async update(id: number, data: Record<string, unknown>): Promise<"updated"> {
    this.updateCalls.push({ id, data: { ...data } });
    return "updated";
  }

  async addEvent(
    id: number,
    tipo: string,
    mensagem: string,
    payload?: unknown,
  ): Promise<void> {
    this.eventCalls.push({ id, tipo, mensagem, payload });
  }
}

class FakePedidoRepository {
  findPendentesCalls = 0;

  constructor(readonly pedido: Pedido) {}

  async findById(id: number): Promise<Pedido | null> {
    return id === this.pedido.id ? { ...this.pedido } : null;
  }

  async findPendentesParaOtimizacao(): Promise<never> {
    this.findPendentesCalls += 1;
    throw new Error("O orquestrador não pode consultar pedidos pendentes diretamente.");
  }
}

interface FalhaRegistrada {
  idAlocacao: number;
  mensagem: string;
  opcoes: { maxTentativas?: number; bloquearImpressora?: boolean };
}

interface BloqueioRegistrado {
  idAlocacao: number;
  mensagem: string;
  data?: { jobRemotoId?: string | null };
}

class FakePedidoImpressoraRepository {
  reservasProximas: Array<ReservaAlocacao | null> = [];
  reservaDireta: ReservaAlocacao | null = { ...RESERVA };
  confirmarInicioError: Error | null = null;
  readonly atualizarSlotCalls: Array<{ idAlocacao: number; numeroSlot: number }> = [];
  readonly waitingCalls: Array<{ idAlocacao: number; mensagem?: string }> = [];
  readonly falhaCalls: FalhaRegistrada[] = [];
  readonly bloqueioCalls: BloqueioRegistrado[] = [];
  readonly confirmarInicioCalls: Array<{ idAlocacao: number; data: unknown }> = [];
  planoListado: Array<{
    id: number;
    idPedido: number;
    idImpressora: number;
    status: "reservado";
  }> = [];

  constructor(private readonly ordem: string[]) {}

  async reservarProximaAlocacao(): Promise<ReservaAlocacao | null> {
    return this.reservasProximas.shift() ?? null;
  }

  async reservarAlocacao(): Promise<ReservaAlocacao | null> {
    return this.reservaDireta ? { ...this.reservaDireta } : null;
  }

  async possuiPedidosPendentesSemPlano(): Promise<boolean> {
    return false;
  }

  async listarPlano(): Promise<typeof this.planoListado> {
    return this.planoListado.map((item) => ({ ...item }));
  }

  async atualizarSlotReservado(idAlocacao: number, numeroSlot: number): Promise<void> {
    this.atualizarSlotCalls.push({ idAlocacao, numeroSlot });
  }

  async marcarAguardandoFilamento(idAlocacao: number, mensagem?: string): Promise<void> {
    this.waitingCalls.push({ idAlocacao, mensagem });
  }

  async marcarFalhaAntesDoInicio(
    idAlocacao: number,
    mensagem: string,
    opcoes: { maxTentativas?: number; bloquearImpressora?: boolean },
  ): Promise<{ status: "na_fila" | "falhou"; tentativasInicio: number; proximaTentativaEm: Date | null }> {
    this.falhaCalls.push({ idAlocacao, mensagem, opcoes });
    const terminal = (opcoes.maxTentativas ?? 3) <= 1;
    return { status: terminal ? "falhou" : "na_fila", tentativasInicio: 1, proximaTentativaEm: null };
  }

  async bloquearReservaComInicioIncerto(
    idAlocacao: number,
    mensagem: string,
    data?: { jobRemotoId?: string | null },
  ): Promise<void> {
    this.bloqueioCalls.push({ idAlocacao, mensagem, data });
  }

  async confirmarInicio(idAlocacao: number, data: unknown): Promise<void> {
    this.ordem.push("repository:confirmarInicio");
    this.confirmarInicioCalls.push({ idAlocacao, data });
    if (this.confirmarInicioError) throw this.confirmarInicioError;
  }

  async reconciliarInicioConfirmado(idAlocacao: number, data: unknown): Promise<void> {
    this.ordem.push("repository:reconciliarInicio");
    this.confirmarInicioCalls.push({ idAlocacao, data });
  }
}

class FakeControlAdapter implements IPrinterCommunicationAdapter {
  readonly protocolo = "DUMMY" as const;
  healthResult: PrinterHealthCheckResult = { ok: true, mensagem: "health ok" };
  statusResult: PrinterRuntimeStatus = {
    disponivel: true,
    statusDominio: "Imprimindo",
    statusFisico: "printing",
    jobRemotoId: "cfs-job",
  };
  statusResults: PrinterRuntimeStatus[] = [
    {
      disponivel: true,
      statusDominio: "Ociosa",
      statusFisico: "idle",
      jobRemotoId: null,
    },
  ];
  uploadResult: PrinterStartJobResult = {
    ok: true,
    mensagem: "upload comum iniciado",
    jobRemotoId: "common-job",
  };
  healthCalls = 0;
  uploadCalls = 0;
  statusCalls = 0;
  desligarCalls = 0;
  cancelarCalls = 0;
  inicioExternoCalls: Array<{ idImpressora: number; jobRemotoId: string }> = [];

  async healthCheck(): Promise<PrinterHealthCheckResult> {
    this.healthCalls += 1;
    return this.healthResult;
  }

  async uploadAndStart(
    _impressora: Impressora,
    _payload: PrinterJobPayload,
  ): Promise<PrinterStartJobResult> {
    this.uploadCalls += 1;
    return this.uploadResult;
  }

  async getStatus(): Promise<PrinterRuntimeStatus> {
    this.statusCalls += 1;
    return this.statusResults.shift() ?? this.statusResult;
  }

  registrarInicioExternoSimulado(
    impressora: Impressora,
    jobRemotoId: string,
  ): void {
    this.inicioExternoCalls.push({ idImpressora: impressora.id, jobRemotoId });
  }

  async desligarAquecedores(): Promise<void> {
    this.desligarCalls += 1;
  }

  async cancelarImpressao(): Promise<void> {
    this.cancelarCalls += 1;
  }
}

class FakeCfsAdapter implements CfsPrintSubmissionAdapter {
  readonly tipo = "DUMMY_CFS" as const;
  inventario: CfsInventory = inventarioSlot();
  resultado: CfsPrintStartResult = {
    ok: true,
    aceito: true,
    confirmadoFisicamente: true,
    mensagem: "CFS iniciado e confirmado",
    jobRemotoId: "cfs-job",
    nomeArquivoRemoto: "pedido_101.gcode",
    mapeamentoAplicado: [],
  };
  consultarCalls = 0;
  enviarCalls = 0;
  ecoarMapeamentoSolicitado = true;
  enviarError: Error | null = null;
  ultimaSubmissao: CfsPrintSubmission | null = null;

  constructor(private readonly ordem: string[]) {}

  async consultarInventarioCfs(): Promise<CfsInventory> {
    this.consultarCalls += 1;
    return {
      ...this.inventario,
      itens: this.inventario.itens.map((item) => ({ ...item })),
    };
  }

  async enviarEIniciarComMapeamento(
    _impressora: Impressora,
    entrada: CfsPrintSubmission,
  ): Promise<CfsPrintStartResult> {
    this.ordem.push(
      `cfs:resultado:${this.resultado.confirmadoFisicamente ? "confirmado" : "incerto"}`,
    );
    this.enviarCalls += 1;
    this.ultimaSubmissao = {
      ...entrada,
      filamentos: entrada.filamentos.map((item) => ({
        ...item,
        materialPlanejado: { ...item.materialPlanejado },
        enderecoFisico: { ...item.enderecoFisico },
      })),
    };
    if (this.enviarError) throw this.enviarError;
    const mapeamentoAplicado = this.ecoarMapeamentoSolicitado
      ? entrada.filamentos
      : this.resultado.mapeamentoAplicado;
    return {
      ...this.resultado,
      mapeamentoAplicado: mapeamentoAplicado.map((item) => ({
        ...item,
        materialPlanejado: { ...item.materialPlanejado },
        enderecoFisico: { ...item.enderecoFisico },
      })),
    };
  }
}

class FakeAdapterFactory {
  getAdapterCalls = 0;
  getCfsAdapterCalls = 0;

  constructor(
    readonly controle: FakeControlAdapter,
    readonly cfs: FakeCfsAdapter,
  ) {}

  getAdapter(): IPrinterCommunicationAdapter {
    this.getAdapterCalls += 1;
    return this.controle;
  }

  getCfsAdapter(): CfsPrintSubmissionAdapter {
    this.getCfsAdapterCalls += 1;
    return this.cfs;
  }
}

class FakePlanejadorFila {
  calls = 0;

  async reescalonarFilaVirtual(): Promise<void> {
    this.calls += 1;
  }
}

function criarCenario(options: { pedido?: Pedido; impressora?: Impressora } = {}) {
  const ordem: string[] = [];
  const impressoraRepository = new FakeImpressoraRepository(
    options.impressora ?? criarImpressora(),
  );
  const pedidoRepository = new FakePedidoRepository(options.pedido ?? criarPedido());
  const filaRepository = new FakePedidoImpressoraRepository(ordem);
  const controle = new FakeControlAdapter();
  const cfs = new FakeCfsAdapter(ordem);
  const factory = new FakeAdapterFactory(controle, cfs);
  const planejador = new FakePlanejadorFila();
  const service = new ImpressoraOrquestradorService(
    impressoraRepository as unknown as ImpressoraRepository,
    pedidoRepository as unknown as PedidoRepository,
    {} as ArquivoRepository,
    factory as unknown as PrinterAdapterFactory,
    filaRepository as unknown as PedidoImpressoraRepository,
    planejador,
    async () => {},
  );
  return {
    service,
    ordem,
    impressoraRepository,
    pedidoRepository,
    filaRepository,
    controle,
    cfs,
    factory,
    planejador,
  };
}

async function esperarRejeicao(
  acao: () => Promise<unknown>,
  trechoMensagem: RegExp,
): Promise<Error> {
  let erroCapturado: unknown;
  try {
    await acao();
  } catch (erro) {
    erroCapturado = erro;
  }
  if (!(erroCapturado instanceof Error)) {
    throw new Error(`Era esperada uma rejeição contendo ${trechoMensagem}.`);
  }
  assert.match(erroCapturado.message, trechoMensagem);
  return erroCapturado;
}

describe("ImpressoraOrquestradorService — fila planejada e CFS", () => {
  it("consome a reserva de pedido_impressora sem consultar pedidos pendentes", async () => {
    const cenario = criarCenario();
    cenario.filaRepository.reservasProximas = [{ ...RESERVA }, null];

    const resultado = await cenario.service.tentarAtribuirAutomaticamente();

    assert.deepEqual(resultado, [{ pedidoId: 101, impressoraId: 17 }]);
    assert.equal(cenario.pedidoRepository.findPendentesCalls, 0);
    assert.equal(cenario.planejador.calls, 0);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 1);
  });

  it("revalida slot alterado, atualiza a reserva e monta mapeamento físico seguro", async () => {
    const impressora = criarImpressora({
      filamentosCarregados: [
        {
          numeroSlot: 2,
          material: { id: 999, nome: "Outro", tipo: "PETG", cor: "#ffffff" },
        },
        {
          numeroSlot: 4,
          material: { id: 301, nome: "PLA preto", tipo: "PLA", cor: "#000000" },
        },
      ],
    });
    const cenario = criarCenario({ impressora });
    cenario.cfs.inventario = inventarioSlot(4);

    await cenario.service.atribuirPedido(17, 101);

    assert.deepEqual(cenario.filaRepository.atualizarSlotCalls, [
      { idAlocacao: 501, numeroSlot: 4 },
    ]);
    assert.equal(cenario.controle.uploadCalls, 0, "CFS não pode usar uploadAndStart comum");
    assert.equal(cenario.controle.statusCalls, 2, "CFS deve fazer preflight e polling físico");
    assert.deepEqual(cenario.controle.inicioExternoCalls, [
      { idImpressora: 17, jobRemotoId: "cfs-job" },
    ]);
    assert.equal(cenario.cfs.ultimaSubmissao?.openCfs, true);
    assert.equal(cenario.cfs.ultimaSubmissao?.filamentos.length, 1);
    const mapeamento = cenario.cfs.ultimaSubmissao!.filamentos[0];
    assert.equal(mapeamento.extrusorLogico, 7);
    assert.deepEqual(mapeamento.materialPlanejado, {
      idMaterialBanco: 301,
      numeroSlot: 4,
    });
    assert.deepEqual(mapeamento.enderecoFisico, {
      numeroSlot: 4,
      boxId: "device-box-a",
      deviceMaterialId: "device-material-slot-4",
    });
    assert.notEqual(
      String(mapeamento.materialPlanejado.idMaterialBanco),
      String(mapeamento.enderecoFisico.deviceMaterialId),
    );
  });

  it("material ausente marca waiting e não consulta nenhum adapter", async () => {
    const cenario = criarCenario({
      impressora: criarImpressora({
        filamentosCarregados: [
          {
            numeroSlot: 2,
            material: { id: 999, nome: "Outro", tipo: "PETG", cor: "#ffffff" },
          },
        ],
      }),
    });

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /aguardando o material 301/,
    );

    assert.equal(cenario.filaRepository.waitingCalls.length, 1);
    assert.equal(cenario.filaRepository.falhaCalls.length, 0);
    assert.equal(cenario.factory.getAdapterCalls, 0);
    assert.equal(cenario.factory.getCfsAdapterCalls, 0);
    assert.equal(cenario.controle.uploadCalls, 0);
  });

  it("divergência entre banco e inventário bloqueia antes do health ou envio", async () => {
    const cenario = criarCenario();
    cenario.cfs.inventario = inventarioSlot(2, { tipoMaterial: "PETG" });

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /Divergência entre banco e inventário físico/,
    );

    assert.equal(cenario.cfs.consultarCalls, 1);
    assert.equal(cenario.cfs.enviarCalls, 0);
    assert.equal(cenario.controle.healthCalls, 0);
    assert.equal(cenario.controle.uploadCalls, 0);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
    assert.deepEqual(cenario.filaRepository.falhaCalls[0]?.opcoes, {
      maxTentativas: 1,
      bloquearImpressora: false,
    });
  });

  it("libera falha rejeitada e bloqueia início aceito porém fisicamente incerto", async () => {
    const rejeitado = criarCenario();
    rejeitado.cfs.resultado = {
      ...rejeitado.cfs.resultado,
      ok: false,
      aceito: false,
      confirmadoFisicamente: false,
      mensagem: "mapeamento rejeitado",
    };
    await esperarRejeicao(
      () => rejeitado.service.atribuirPedido(17, 101),
      /mapeamento rejeitado/,
    );
    assert.equal(rejeitado.filaRepository.falhaCalls[0]?.opcoes.bloquearImpressora, false);
    assert.equal(rejeitado.filaRepository.bloqueioCalls.length, 0);
    assert.equal(rejeitado.filaRepository.confirmarInicioCalls.length, 0);

    const incerto = criarCenario();
    incerto.cfs.resultado = {
      ...incerto.cfs.resultado,
      confirmadoFisicamente: true,
      mensagem: "adapter alegou confirmação",
    };
    incerto.controle.statusResult = {
      disponivel: false,
      statusDominio: "Erro",
      statusFisico: "physical-error",
      mensagem: "falha física simulada",
    };
    await esperarRejeicao(
      () => incerto.service.atribuirPedido(17, 101),
      /falha física simulada/,
    );
    assert.equal(incerto.filaRepository.falhaCalls.length, 0);
    assert.equal(incerto.filaRepository.bloqueioCalls.length, 1);
    assert.equal(incerto.filaRepository.confirmarInicioCalls.length, 0);
    assert.equal(incerto.controle.statusCalls, 2, "preflight e confirmação devem consultar estado");
  });

  it("bloqueia o envio quando o preflight encontra a impressora fisicamente ocupada", async () => {
    const cenario = criarCenario();
    cenario.controle.statusResults = [{
      disponivel: true,
      statusDominio: "Imprimindo",
      statusFisico: "printing-existing-job",
      jobRemotoId: "outro-job.gcode",
    }];

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /não está fisicamente ociosa/,
    );

    assert.equal(cenario.cfs.enviarCalls, 0);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
    assert.equal(cenario.filaRepository.bloqueioCalls.length, 1);
    assert.equal(cenario.filaRepository.falhaCalls.length, 0);
  });

  it("não confia na confirmação do adapter e correlaciona o job observado", async () => {
    const cenario = criarCenario();
    cenario.cfs.resultado = {
      ...cenario.cfs.resultado,
      confirmadoFisicamente: false,
      mensagem: "aceito, aguardando estado",
    };
    cenario.controle.statusResults = [
      {
        disponivel: true,
        statusDominio: "Ociosa",
        statusFisico: "idle",
        jobRemotoId: null,
      },
      {
        disponivel: true,
        statusDominio: "Imprimindo",
        statusFisico: "printing-wrong-job",
        jobRemotoId: "outro-job.gcode",
      },
      {
        disponivel: true,
        statusDominio: "Imprimindo",
        statusFisico: "printing-correct-job",
        jobRemotoId: "pedido_101.gcode",
      },
    ];

    await cenario.service.atribuirPedido(17, 101);

    assert.equal(cenario.controle.statusCalls, 3);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 1);
    assert.equal(cenario.filaRepository.bloqueioCalls.length, 0);
  });

  it("preserva a reserva quando o adapter lança erro depois do disparo", async () => {
    const cenario = criarCenario();
    cenario.cfs.enviarError = new Error("conexão caiu após o envio");

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /conexão caiu após o envio/,
    );

    assert.equal(cenario.filaRepository.falhaCalls.length, 0);
    assert.equal(cenario.filaRepository.bloqueioCalls.length, 1);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
  });

  it("bloqueia matrizes incoerentes de aceite e confirmação do CFS", async () => {
    const resultados: Array<Partial<CfsPrintStartResult>> = [
      { ok: false, aceito: true, confirmadoFisicamente: false },
      { ok: true, aceito: false, confirmadoFisicamente: true },
      { ok: false, aceito: false, confirmadoFisicamente: true },
    ];

    for (const parcial of resultados) {
      const cenario = criarCenario();
      cenario.cfs.resultado = { ...cenario.cfs.resultado, ...parcial };

      await esperarRejeicao(
        () => cenario.service.atribuirPedido(17, 101),
        /estado incoerente/,
      );

      assert.equal(cenario.filaRepository.falhaCalls.length, 0);
      assert.equal(cenario.filaRepository.bloqueioCalls.length, 1);
      assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
    }
  });

  it("bloqueia quando o adapter declara ter aplicado outro mapeamento", async () => {
    const cenario = criarCenario();
    cenario.cfs.ecoarMapeamentoSolicitado = false;
    cenario.cfs.resultado = {
      ...cenario.cfs.resultado,
      mapeamentoAplicado: [{
        extrusorLogico: 7,
        materialPlanejado: { idMaterialBanco: 301, numeroSlot: 2 },
        enderecoFisico: {
          numeroSlot: 2,
          boxId: "device-box-a",
          deviceMaterialId: "outro-material-fisico",
        },
        tipoMaterial: "PLA",
        cor: "#000000",
      }],
    };

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /mapeamento informado como aplicado.*diverge/,
    );

    assert.equal(cenario.filaRepository.falhaCalls.length, 0);
    assert.equal(cenario.filaRepository.bloqueioCalls.length, 1);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
  });

  it("confirma no banco somente depois da confirmação física", async () => {
    const cenario = criarCenario();

    await cenario.service.atribuirPedido(17, 101);

    assert.deepEqual(cenario.ordem, [
      "cfs:resultado:confirmado",
      "repository:confirmarInicio",
    ]);
    assert.equal(cenario.controle.statusCalls, 2, "preflight deve preceder o polling físico");
  });

  it("falha de persistência após início físico bloqueia impressora sem liberar reserva", async () => {
    const cenario = criarCenario();
    cenario.filaRepository.confirmarInicioError = new Error("banco indisponível");

    await esperarRejeicao(
      () => cenario.service.atribuirPedido(17, 101),
      /persistência transacional falhou/,
    );

    assert.equal(cenario.filaRepository.falhaCalls.length, 0);
    assert.equal(cenario.filaRepository.bloqueioCalls.length, 1);
    assert.equal(
      cenario.filaRepository.bloqueioCalls[0].data?.jobRemotoId,
      "cfs-job",
    );
    assert.equal(cenario.impressoraRepository.markErrorCalls.length, 0);
  });

  it("sincroniza reserva ambígua ociosa sem apagar o erro nem liberar a reserva", async () => {
    const cenario = criarCenario({
      impressora: criarImpressora({
        status: "Erro",
        ultimoErro: "início anterior incerto",
        idPedidoAtual: 101,
        jobRemotoId: "pedido_101.gcode",
      }),
    });
    cenario.controle.statusResults = [];
    cenario.controle.statusResult = {
      disponivel: true,
      statusDominio: "Ociosa",
      statusFisico: "idle-after-uncertain-start",
      jobRemotoId: null,
    };
    cenario.filaRepository.planoListado = [{
      id: 501,
      idPedido: 101,
      idImpressora: 17,
      status: "reservado",
    }];

    await cenario.service.sincronizarStatus(17);

    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
    assert.equal(cenario.impressoraRepository.updateCalls.length, 1);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        cenario.impressoraRepository.updateCalls[0].data,
        "ultimoErro",
      ),
      false,
    );
  });

  it("reconcilia reserva ambígua somente quando o estado físico confirma Imprimindo", async () => {
    const cenario = criarCenario({
      impressora: criarImpressora({
        status: "Erro",
        ultimoErro: "início anterior incerto",
        idPedidoAtual: 101,
        jobRemotoId: "pedido_101.gcode",
      }),
    });
    cenario.controle.statusResults = [];
    cenario.controle.statusResult = {
      disponivel: true,
      statusDominio: "Imprimindo",
      statusFisico: "printing-reconciled",
      jobRemotoId: "pedido_101.gcode",
    };
    cenario.filaRepository.planoListado = [{
      id: 501,
      idPedido: 101,
      idImpressora: 17,
      status: "reservado",
    }];

    await cenario.service.sincronizarStatus(17);

    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 1);
    assert.equal(cenario.ordem[cenario.ordem.length - 1], "repository:reconciliarInicio");
  });

  it("mantém bloqueada uma reserva ambígua quando o job físico diverge", async () => {
    const cenario = criarCenario({
      impressora: criarImpressora({
        status: "Erro",
        ultimoErro: "início anterior incerto",
        idPedidoAtual: 101,
        jobRemotoId: "pedido_101.gcode",
      }),
    });
    cenario.controle.statusResults = [];
    cenario.controle.statusResult = {
      disponivel: true,
      statusDominio: "Imprimindo",
      statusFisico: "printing-other-job",
      jobRemotoId: "outro_pedido.gcode",
    };
    cenario.filaRepository.planoListado = [{
      id: 501,
      idPedido: 101,
      idImpressora: 17,
      status: "reservado",
    }];

    await cenario.service.sincronizarStatus(17);

    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
    assert.equal(
      Object.prototype.hasOwnProperty.call(
        cenario.impressoraRepository.updateCalls[0].data,
        "jobRemotoId",
      ),
      false,
    );
  });

  it("não desliga aquecedores nem libera manualmente uma reserva ambígua", async () => {
    const cenario = criarCenario({
      impressora: criarImpressora({
        status: "Erro",
        ultimoErro: "início anterior incerto",
        idPedidoAtual: 101,
        jobRemotoId: "pedido_101.gcode",
      }),
    });

    await esperarRejeicao(
      () => cenario.service.liberarImpressora(17),
      /reconcilie o estado físico/,
    );

    assert.equal(cenario.controle.desligarCalls, 0);
    assert.equal(cenario.filaRepository.confirmarInicioCalls.length, 0);
  });
});
