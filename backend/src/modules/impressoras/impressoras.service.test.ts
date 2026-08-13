import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CreateImpressoraRepositoryDTO,
  DeleteImpressoraResult,
  DeleteSlotResult,
  Impressora,
  ImpressoraRepository,
  SlotFilamento,
  UpdateImpressoraRepositoryDTO,
  UpdateImpressoraResult,
  UpsertSlotResult,
} from "./impressoras.repository";
import {
  CreateImpressoraServiceDTO,
  ImpressoraService,
  ImpressoraServiceError,
  ReplanejadorFila,
} from "./impressoras.service";
import {
  Material,
  MaterialRepository,
} from "../materiais/materiais.repository";
import { db } from "../../database/connection";

function cloneSlot(slot: SlotFilamento): SlotFilamento {
  return {
    numeroSlot: slot.numeroSlot,
    material: { ...slot.material },
  };
}

function cloneImpressora(impressora: Impressora): Impressora {
  return {
    ...impressora,
    filamentosCarregados: impressora.filamentosCarregados
      .map(cloneSlot)
      .sort((left, right) => left.numeroSlot - right.numeroSlot),
  };
}

class FakeMaterialRepository {
  private readonly materiais = new Map<number, Material>();

  constructor(ids: number[] = [1, 2, 3]) {
    for (const id of ids) {
      this.materiais.set(id, {
        id,
        nome: `Material ${id}`,
        tipo: id === 2 ? "PETG" : "PLA",
        preco: 0.1 * id,
        status: "disponivel",
        cor: `Cor ${id}`,
        diametro: 1.75,
        tempBicoMin: null,
        tempBicoMax: null,
        tempBicoRecomendada: null,
        tempMesaMin: null,
        tempMesaMax: null,
        tempMesaRecomendada: null,
        fanMin: null,
        fanMax: null,
        camadaMin: null,
        camadaMax: null,
      });
    }
  }

  async findById(id: number): Promise<Material | null> {
    const material = this.materiais.get(id);
    return material ? { ...material } : null;
  }

  get(id: number): Material {
    const material = this.materiais.get(id);
    if (!material) throw new Error(`Material ${id} ausente no fake.`);
    return material;
  }
}

class FakeReplanejadorFila implements ReplanejadorFila {
  calls = 0;

  async reescalonarFilaVirtual(): Promise<void> {
    this.calls += 1;
  }
}

class FakeImpressoraRepository {
  private readonly impressoras = new Map<number, Impressora>();
  private nextId = 1;
  createCalls = 0;

  constructor(private readonly materiais: FakeMaterialRepository) {}

  get size(): number {
    return this.impressoras.size;
  }

  definirUso(id: number, status: Impressora["status"], idPedidoAtual: number | null): void {
    const impressora = this.impressoras.get(id);
    if (!impressora) throw new Error("Impressora ausente no fake.");
    impressora.status = status;
    impressora.idPedidoAtual = idPedidoAtual;
  }

  async findAll(): Promise<Impressora[]> {
    return [...this.impressoras.values()]
      .sort((left, right) => right.id - left.id)
      .map(cloneImpressora);
  }

  async findById(id: number): Promise<Impressora | null> {
    const impressora = this.impressoras.get(id);
    return impressora ? cloneImpressora(impressora) : null;
  }

  async create(data: CreateImpressoraRepositoryDTO): Promise<number> {
    this.createCalls += 1;
    const id = this.nextId;
    this.nextId += 1;
    const filamentosCarregados = (data.filamentosCarregados ?? []).map((slot) => {
      const material = this.materiais.get(slot.idMaterial);
      return {
        numeroSlot: slot.numeroSlot,
        material: {
          id: material.id,
          nome: material.nome,
          tipo: material.tipo,
          cor: material.cor,
        },
      };
    });
    filamentosCarregados.sort((left, right) => left.numeroSlot - right.numeroSlot);

    this.impressoras.set(id, {
      id,
      nome: data.nome,
      modelo: data.modelo,
      status: data.status,
      ip: data.ip ?? null,
      baseUrl: data.baseUrl ?? null,
      api: data.api,
      api_key: data.api_key ?? null,
      timeoutMs: data.timeoutMs ?? 15000,
      statusFisico: data.statusFisico ?? null,
      jobRemotoId: data.jobRemotoId ?? null,
      ultimoErro: data.ultimoErro ?? null,
      ultimaSincronizacao: data.ultimaSincronizacao ?? null,
      possuiCfs: data.possuiCfs,
      larguraMesaMm: data.larguraMesaMm,
      profundidadeMesaMm: data.profundidadeMesaMm,
      filamentosCarregados,
      idPedidoAtual: null,
      eficiencia: data.eficiencia ?? 1,
      taxaErroRecente: data.taxaErroRecente ?? 0,
      tempoParaFicarLivreHoras: data.tempoParaFicarLivreHoras ?? 0,
      capacidadeDiaHoras: data.capacidadeDiaHoras ?? 8,
    });
    return id;
  }

  async update(id: number, data: UpdateImpressoraRepositoryDTO): Promise<UpdateImpressoraResult> {
    const impressora = this.impressoras.get(id);
    if (!impressora) return "not_found";
    const alteraEstadoOuConexao =
      data.status !== undefined ||
      data.api !== undefined ||
      data.ip !== undefined ||
      data.baseUrl !== undefined ||
      data.api_key !== undefined ||
      data.timeoutMs !== undefined ||
      data.possuiCfs !== undefined;
    if (
      alteraEstadoOuConexao &&
      (impressora.status === "Reservada" ||
        impressora.status === "Imprimindo" ||
        impressora.idPedidoAtual !== null)
    ) {
      return "printer_busy";
    }
    if (
      data.possuiCfs === false &&
      impressora.filamentosCarregados.some((slot) => slot.numeroSlot > 1)
    ) {
      return "additional_slots";
    }
    Object.assign(impressora, data);
    return "updated";
  }

  async upsertSlot(
    idImpressora: number,
    numeroSlot: number,
    idMaterial: number,
  ): Promise<UpsertSlotResult> {
    const impressora = this.impressoras.get(idImpressora);
    if (!impressora) return "printer_not_found";
    if (
      impressora.status === "Reservada" ||
      impressora.status === "Imprimindo" ||
      impressora.idPedidoAtual !== null
    ) {
      return "printer_busy";
    }
    if (!impressora.possuiCfs && numeroSlot !== 1) return "slot_not_allowed";

    const material = this.materiais.get(idMaterial);
    const slot: SlotFilamento = {
      numeroSlot,
      material: {
        id: material.id,
        nome: material.nome,
        tipo: material.tipo,
        cor: material.cor,
      },
    };
    const index = impressora.filamentosCarregados.findIndex(
      (carregado) => carregado.numeroSlot === numeroSlot,
    );
    if (index >= 0) impressora.filamentosCarregados[index] = slot;
    else impressora.filamentosCarregados.push(slot);
    return "updated";
  }

  async deleteSlot(idImpressora: number, numeroSlot: number): Promise<DeleteSlotResult> {
    const impressora = this.impressoras.get(idImpressora);
    if (!impressora) return "printer_not_found";
    if (
      impressora.status === "Reservada" ||
      impressora.status === "Imprimindo" ||
      impressora.idPedidoAtual !== null
    ) {
      return "printer_busy";
    }
    if (!impressora.possuiCfs && numeroSlot !== 1) return "slot_not_allowed";
    const totalAntes = impressora.filamentosCarregados.length;
    impressora.filamentosCarregados = impressora.filamentosCarregados.filter(
      (slot) => slot.numeroSlot !== numeroSlot,
    );
    return impressora.filamentosCarregados.length < totalAntes
      ? "deleted"
      : "slot_not_found";
  }

  async delete(id: number): Promise<DeleteImpressoraResult> {
    const impressora = this.impressoras.get(id);
    if (!impressora) return "not_found";
    if (
      impressora.status === "Reservada" ||
      impressora.status === "Imprimindo" ||
      impressora.idPedidoAtual !== null
    ) {
      return "printer_busy";
    }
    this.impressoras.delete(id);
    return "deleted";
  }

  async findParaOtimizacao(): Promise<never[]> {
    return [];
  }

  async release(): Promise<void> {}

  async markError(): Promise<void> {}

  async addEvent(): Promise<void> {}

  async listEvents(): Promise<never[]> {
    return [];
  }
}

interface TestHarness {
  service: ImpressoraService;
  impressoras: FakeImpressoraRepository;
  replanejador: FakeReplanejadorFila;
}

function createHarness(materialIds: number[] = [1, 2, 3]): TestHarness {
  const materiais = new FakeMaterialRepository(materialIds);
  const impressoras = new FakeImpressoraRepository(materiais);
  const replanejador = new FakeReplanejadorFila();
  return {
    impressoras,
    replanejador,
    service: new ImpressoraService(
      impressoras as unknown as ImpressoraRepository,
      materiais as unknown as MaterialRepository,
      replanejador,
    ),
  };
}

function createInput(
  overrides: Partial<CreateImpressoraServiceDTO> = {},
): CreateImpressoraServiceDTO {
  return {
    nome: "Impressora de teste",
    modelo: "Modelo de teste",
    api: "DUMMY",
    possuiCfs: false,
    larguraMesaMm: 220,
    profundidadeMesaMm: 220,
    ...overrides,
  };
}

async function expectServiceError(
  operation: () => Promise<unknown>,
  statusCode: 400 | 404 | 409,
): Promise<ImpressoraServiceError> {
  let captured: unknown;
  try {
    await operation();
  } catch (error) {
    captured = error;
  }
  if (!(captured instanceof ImpressoraServiceError)) {
    throw new Error("A operação deveria lançar ImpressoraServiceError.");
  }
  assert.equal(captured.statusCode, statusCode);
  return captured;
}

test("1. cria impressora sem CFS e sem filamento", async () => {
  const { service } = createHarness();

  const impressora = await service.criar(createInput());

  assert.equal(impressora.possuiCfs, false);
  assert.deepEqual(impressora.filamentosCarregados, []);
});

test("2. cria impressora sem CFS com filamento no slot 1", async () => {
  const { service } = createHarness();

  const impressora = await service.criar(createInput({
    filamentosCarregados: [{ numeroSlot: 1, idMaterial: 1 }],
  }));

  assert.deepEqual(
    impressora.filamentosCarregados.map((slot) => [slot.numeroSlot, slot.material.id]),
    [[1, 1]],
  );
});

test("3. rejeita impressora sem CFS com material no slot 2", async () => {
  const { service, impressoras } = createHarness();

  const error = await expectServiceError(
    () => service.criar(createInput({
      filamentosCarregados: [{ numeroSlot: 2, idMaterial: 1 }],
    })),
    409,
  );

  assert.match(error.message, /somente o slot 1/i);
  assert.equal(impressoras.size, 0);
});

test("4. cria impressora com CFS e vários materiais", async () => {
  const { service } = createHarness();

  const impressora = await service.criar(createInput({
    possuiCfs: true,
    filamentosCarregados: [
      { numeroSlot: 3, idMaterial: 3 },
      { numeroSlot: 1, idMaterial: 1 },
      { numeroSlot: 2, idMaterial: 2 },
    ],
  }));

  assert.deepEqual(
    impressora.filamentosCarregados.map((slot) => [slot.numeroSlot, slot.material.id]),
    [[1, 1], [2, 2], [3, 3]],
  );
});

test("5. rejeita números de slot repetidos", async () => {
  const { service, impressoras } = createHarness();

  const error = await expectServiceError(
    () => service.criar(createInput({
      possuiCfs: true,
      filamentosCarregados: [
        { numeroSlot: 1, idMaterial: 1 },
        { numeroSlot: 1, idMaterial: 2 },
      ],
    })),
    400,
  );

  assert.match(error.message, /mais de uma vez/i);
  assert.equal(impressoras.createCalls, 0);
});

test("6. rejeita slot 0 e slot maior que 4", async () => {
  for (const numeroSlot of [0, 5]) {
    const { service, impressoras } = createHarness();
    const error = await expectServiceError(
      () => service.criar(createInput({
        possuiCfs: true,
        filamentosCarregados: [{ numeroSlot, idMaterial: 1 }],
      })),
      400,
    );

    assert.match(error.message, /inteiro entre 1 e 4/i);
    assert.equal(impressoras.size, 0);
  }
});

test("7. rejeita material inexistente", async () => {
  const { service, impressoras } = createHarness([1]);

  const error = await expectServiceError(
    () => service.criar(createInput({
      filamentosCarregados: [{ numeroSlot: 1, idMaterial: 999 }],
    })),
    404,
  );

  assert.match(error.message, /material 999/i);
  assert.equal(impressoras.createCalls, 0);
});

test("8. atualiza as dimensões da mesa", async () => {
  const { service } = createHarness();
  const criada = await service.criar(createInput());

  const atualizada = await service.atualizar(criada.id, {
    larguraMesaMm: 300.5,
    profundidadeMesaMm: 310.25,
  });

  assert.ok(atualizada);
  assert.equal(atualizada.larguraMesaMm, 300.5);
  assert.equal(atualizada.profundidadeMesaMm, 310.25);
  assert.equal(atualizada.nome, criada.nome);
});

test("bloqueia estado, protocolo e conexão durante reserva ou impressão", async () => {
  const mutacoes = [
    { status: "Erro" as const },
    { api: "MOONRAKER" as const },
    { ip: "192.0.2.10" },
    { baseUrl: "http://printer.invalid" },
    { api_key: "segredo-de-teste" },
    { timeoutMs: 2000 },
    { possuiCfs: true },
  ];

  for (const status of ["Reservada", "Imprimindo"] as const) {
    for (const mutacao of mutacoes) {
      const { service } = createHarness();
      const criada = await service.criar(createInput({ status }));
      const error = await expectServiceError(
        () => service.atualizar(criada.id, mutacao),
        409,
      );
      assert.match(error.message, /reservada ou imprimindo/i);
    }
  }
});

test("estado incerto Erro com pedido associado bloqueia CRUD e slots", async () => {
  const { service, impressoras, replanejador } = createHarness();
  const criada = await service.criar(createInput({
    possuiCfs: true,
    filamentosCarregados: [{ numeroSlot: 1, idMaterial: 1 }],
  }));
  impressoras.definirUso(criada.id, "Erro", 77);

  await expectServiceError(
    () => service.atualizar(criada.id, { api: "MOONRAKER" }),
    409,
  );
  await expectServiceError(
    () => service.carregarFilamento(criada.id, 1, 2),
    409,
  );
  await expectServiceError(
    () => service.descarregarFilamento(criada.id, 1),
    409,
  );
  await expectServiceError(() => service.remover(criada.id), 409);

  assert.equal(replanejador.calls, 0);
  assert.equal((await service.buscarPorId(criada.id))?.filamentosCarregados[0]?.material.id, 1);
});

test("9. carrega e substitui o material de um slot", async () => {
  const { service } = createHarness();
  const criada = await service.criar(createInput({ possuiCfs: true }));

  const carregada = await service.carregarFilamento(criada.id, 2, 1);
  assert.deepEqual(
    carregada.filamentosCarregados.map((slot) => [slot.numeroSlot, slot.material.id]),
    [[2, 1]],
  );

  const substituida = await service.carregarFilamento(criada.id, 2, 2);
  assert.deepEqual(
    substituida.filamentosCarregados.map((slot) => [slot.numeroSlot, slot.material.id]),
    [[2, 2]],
  );
});

test("10. remove o material de um slot", async () => {
  const { service } = createHarness();
  const criada = await service.criar(createInput({
    possuiCfs: true,
    filamentosCarregados: [{ numeroSlot: 4, idMaterial: 1 }],
  }));

  const resultado = await service.descarregarFilamento(criada.id, 4);
  const atualizada = await service.buscarPorId(criada.id);

  assert.match(resultado.message, /slot 4/i);
  if (!atualizada) throw new Error("A impressora atualizada deveria existir.");
  assert.deepEqual(atualizada.filamentosCarregados, []);
});

test("rejeita carregar ou descarregar filamento quando a impressora esta em uso", async () => {
  for (const status of ["Reservada", "Imprimindo"] as const) {
    const { service, replanejador } = createHarness();
    const criada = await service.criar(createInput({
      possuiCfs: true,
      status,
      filamentosCarregados: [{ numeroSlot: 2, idMaterial: 1 }],
    }));

    const erroCarga = await expectServiceError(
      () => service.carregarFilamento(criada.id, 2, 2),
      409,
    );
    const erroDescarga = await expectServiceError(
      () => service.descarregarFilamento(criada.id, 2),
      409,
    );
    const preservada = await service.buscarPorId(criada.id);

    assert.match(erroCarga.message, /reservada ou imprimindo/i);
    assert.match(erroDescarga.message, /reservada ou imprimindo/i);
    assert.equal(replanejador.calls, 0);
    assert.equal(preservada?.filamentosCarregados[0]?.material.id, 1);
  }
});

test("replaneja a fila oficial depois de cada mutacao efetiva de slot", async () => {
  const { service, replanejador } = createHarness();
  const criada = await service.criar(createInput({ possuiCfs: true }));

  await service.carregarFilamento(criada.id, 2, 1);
  assert.equal(replanejador.calls, 1);

  await service.carregarFilamento(criada.id, 2, 2);
  assert.equal(replanejador.calls, 2);

  await service.descarregarFilamento(criada.id, 2);
  assert.equal(replanejador.calls, 3);

  // Slot ja vazio nao representa uma nova mutacao e nao deve replanejar.
  await service.descarregarFilamento(criada.id, 2);
  assert.equal(replanejador.calls, 3);
});

test("11. lista filamentos ordenados por número do slot", async () => {
  const originalExecute = (db as any).execute;
  const queries: string[] = [];
  (db as any).execute = async (sql: string) => {
    queries.push(sql);
    if (queries.length === 1) {
      return [[{
        id: 1,
        nome: "Impressora ordenada",
        modelo: "Modelo",
        possuiCfs: 1,
        larguraMesaMm: "300.00",
        profundidadeMesaMm: "300.00",
        status: "Ociosa",
        ip: null,
        baseUrl: null,
        api: "DUMMY",
        api_key: null,
        timeoutMs: 15000,
        statusFisico: null,
        jobRemotoId: null,
        ultimoErro: null,
        ultimaSincronizacao: null,
        idPedidoAtual: null,
        eficiencia: "1.00",
        taxaErroRecente: "0.0000",
        tempoParaFicarLivreHoras: "0.00",
        capacidadeDiaHoras: "8.00",
      }], []];
    }
    return [[
      { idImpressora: 1, numeroSlot: 4, idMaterial: 1, nomeMaterial: "M1", tipoMaterial: "PLA", corMaterial: "A" },
      { idImpressora: 1, numeroSlot: 1, idMaterial: 3, nomeMaterial: "M3", tipoMaterial: "PLA", corMaterial: "C" },
      { idImpressora: 1, numeroSlot: 2, idMaterial: 2, nomeMaterial: "M2", tipoMaterial: "PETG", corMaterial: "B" },
    ], []];
  };

  try {
    const [impressora] = await new ImpressoraRepository().findAll();
    assert.equal(queries.length, 2);
    assert.match(queries[1], /ORDER BY sf\.id_impressora DESC, sf\.numero_slot ASC/);
    assert.deepEqual(
      impressora.filamentosCarregados.map((slot) => slot.numeroSlot),
      [1, 2, 4],
    );
  } finally {
    (db as any).execute = originalExecute;
  }
});

test("12. rejeita desativar CFS com slots adicionais ocupados", async () => {
  const { service } = createHarness();
  const criada = await service.criar(createInput({
    possuiCfs: true,
    filamentosCarregados: [
      { numeroSlot: 1, idMaterial: 1 },
      { numeroSlot: 2, idMaterial: 2 },
    ],
  }));

  const error = await expectServiceError(
    () => service.atualizar(criada.id, { possuiCfs: false }),
    409,
  );
  const preservada = await service.buscarPorId(criada.id);

  assert.match(error.message, /esvazie os slots 2, 3 e 4/i);
  if (!preservada) throw new Error("A impressora deveria permanecer cadastrada.");
  assert.equal(preservada.possuiCfs, true);
  assert.deepEqual(
    preservada.filamentosCarregados.map((slot) => slot.numeroSlot),
    [1, 2],
  );
});

test("13. não persiste a criação quando um dos materiais é inválido", async () => {
  const originalGetConnection = (db as any).getConnection;
  let slotInsertions = 0;
  let rollbackCalls = 0;
  let commitCalls = 0;
  let releaseCalls = 0;
  let pendingPrinter = false;
  const fkError = Object.assign(new Error("Material inexistente."), {
    code: "ER_NO_REFERENCED_ROW_2",
    errno: 1452,
  });
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      if (/INSERT INTO impressoras/.test(sql)) {
        pendingPrinter = true;
        return [{ insertId: 1 }, []];
      }
      if (/INSERT INTO impressora_slots_filamento/.test(sql)) {
        slotInsertions += 1;
        if (slotInsertions === 2) throw fkError;
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`SQL inesperado no teste: ${sql}`);
    },
    async commit() {
      commitCalls += 1;
    },
    async rollback() {
      rollbackCalls += 1;
      pendingPrinter = false;
    },
    release() {
      releaseCalls += 1;
    },
  };
  (db as any).getConnection = async () => connection;

  try {
    await assert.rejects(
      () => new ImpressoraRepository().create({
        nome: "Rollback",
        modelo: "Modelo",
        api: "DUMMY",
        status: "Ociosa",
        possuiCfs: true,
        larguraMesaMm: 300,
        profundidadeMesaMm: 300,
        filamentosCarregados: [
          { numeroSlot: 1, idMaterial: 1 },
          { numeroSlot: 2, idMaterial: 999 },
        ],
      }),
      (error: unknown) => error === fkError,
    );
    assert.equal(slotInsertions, 2);
    assert.equal(rollbackCalls, 1);
    assert.equal(commitCalls, 0);
    assert.equal(releaseCalls, 1);
    assert.equal(pendingPrinter, false);
  } finally {
    (db as any).getConnection = originalGetConnection;
  }
});

test("repository bloqueia mutacoes de slot sob lock quando a impressora esta ocupada", async () => {
  const originalGetConnection = (db as any).getConnection;
  const selects: string[] = [];
  let beginCalls = 0;
  let rollbackCalls = 0;
  let commitCalls = 0;
  let releaseCalls = 0;
  let mutationCalls = 0;
  const connection = {
    async beginTransaction() {
      beginCalls += 1;
    },
    async execute(sql: string) {
      if (/SELECT possui_cfs AS possuiCfs, status/.test(sql)) {
        selects.push(sql);
        return [[{ possuiCfs: 1, status: "Reservada" }], []];
      }
      mutationCalls += 1;
      return [{ affectedRows: 1 }, []];
    },
    async commit() {
      commitCalls += 1;
    },
    async rollback() {
      rollbackCalls += 1;
    },
    release() {
      releaseCalls += 1;
    },
  };
  (db as any).getConnection = async () => connection;

  try {
    const repository = new ImpressoraRepository();
    assert.equal(await repository.upsertSlot(1, 2, 1), "printer_busy");
    assert.equal(await repository.deleteSlot(1, 2), "printer_busy");
    assert.equal(beginCalls, 2);
    assert.equal(rollbackCalls, 2);
    assert.equal(commitCalls, 0);
    assert.equal(releaseCalls, 2);
    assert.equal(mutationCalls, 0);
    assert.equal(selects.length, 2);
    assert.ok(selects.every((sql) => /FOR UPDATE/.test(sql)));
  } finally {
    (db as any).getConnection = originalGetConnection;
  }
});

test("repository bloqueia update de conexão no estado Erro com pedido atual", async () => {
  const originalGetConnection = (db as any).getConnection;
  let mutationCalls = 0;
  let rollbackCalls = 0;
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      if (/SELECT status, id_pedido_atual AS idPedidoAtual/.test(sql)) {
        return [[{ status: "Erro", idPedidoAtual: 91 }], []];
      }
      mutationCalls += 1;
      return [{ affectedRows: 1 }, []];
    },
    async commit() {},
    async rollback() { rollbackCalls += 1; },
    release() {},
  };
  (db as any).getConnection = async () => connection;

  try {
    const resultado = await new ImpressoraRepository().update(1, { api: "MOONRAKER" });
    assert.equal(resultado, "printer_busy");
    assert.equal(rollbackCalls, 1);
    assert.equal(mutationCalls, 0);
  } finally {
    (db as any).getConnection = originalGetConnection;
  }
});

test("repository remove impressora somente sob lock e sem alocação ativa", async () => {
  const originalGetConnection = (db as any).getConnection;
  let deleteCalls = 0;
  let rollbackCalls = 0;
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      if (/SELECT status, id_pedido_atual AS idPedidoAtual/.test(sql)) {
        return [[{ status: "Ociosa", idPedidoAtual: null }], []];
      }
      if (/FROM pedido_impressora/.test(sql)) {
        return [[{ id: 33 }], []];
      }
      if (/DELETE FROM impressoras/.test(sql)) deleteCalls += 1;
      return [{ affectedRows: 1 }, []];
    },
    async commit() {},
    async rollback() { rollbackCalls += 1; },
    release() {},
  };
  (db as any).getConnection = async () => connection;

  try {
    const resultado = await new ImpressoraRepository().delete(1);
    assert.equal(resultado, "printer_busy");
    assert.equal(rollbackCalls, 1);
    assert.equal(deleteCalls, 0);
  } finally {
    (db as any).getConnection = originalGetConnection;
  }
});

test("release usa compare-and-set e não limpa uma reserva concorrente", async () => {
  const originalExecute = (db as any).execute;
  let capturedSql = "";
  (db as any).execute = async (sql: string) => {
    capturedSql = sql;
    return [{ affectedRows: 0 }, []];
  };

  try {
    await assert.rejects(
      () => new ImpressoraRepository().release(1, "Ociosa"),
      /deixou de aguardar remoção/i,
    );
    assert.match(capturedSql, /status = 'Aguardando Remoção'/);
    assert.match(capturedSql, /id_pedido_atual IS NULL/);
  } finally {
    (db as any).execute = originalExecute;
  }
});
