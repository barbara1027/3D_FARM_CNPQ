import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import mysql, { type Connection } from "mysql2/promise";

const RUN_INTEGRATION = process.env.RUN_MYSQL_INTEGRATION_TESTS === "1";
const CONFIRM_INTEGRATION = process.env.CONFIRM_MYSQL_INTEGRATION_DB === "1";

const REQUIRED_ENV = [
  "MYSQL_INTEGRATION_HOST",
  "MYSQL_INTEGRATION_PORT",
  "MYSQL_INTEGRATION_USER",
  "MYSQL_INTEGRATION_PASSWORD",
  "MYSQL_INTEGRATION_DB_NAME",
] as const;

interface FixtureIds {
  usuario: number;
  material: number;
  qualidade: number;
  arquivo: number;
  pedidos: number[];
  impressora: number;
}

function requiredEnv(name: typeof REQUIRED_ENV[number]): string {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`Teste MySQL requer a variável explícita ${name}.`);
  }
  return value.trim();
}

function integrationConfig() {
  if (!CONFIRM_INTEGRATION) {
    throw new Error(
      "Defina CONFIRM_MYSQL_INTEGRATION_DB=1 para confirmar o uso destrutivo do banco de integração.",
    );
  }

  const database = requiredEnv("MYSQL_INTEGRATION_DB_NAME");
  if (!database.endsWith("_test")) {
    throw new Error("MYSQL_INTEGRATION_DB_NAME deve terminar em _test.");
  }

  const portText = requiredEnv("MYSQL_INTEGRATION_PORT");
  const port = Number(portText);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error("MYSQL_INTEGRATION_PORT deve ser um inteiro entre 1 e 65535.");
  }

  return {
    host: requiredEnv("MYSQL_INTEGRATION_HOST"),
    port,
    user: requiredEnv("MYSQL_INTEGRATION_USER"),
    password: requiredEnv("MYSQL_INTEGRATION_PASSWORD"),
    database,
    timezone: "Z" as const,
  };
}

async function insertId(
  connection: Connection,
  sql: string,
  values: any[],
): Promise<number> {
  const [result]: any = await connection.execute(sql, values);
  return Number(result.insertId);
}

async function createFixture(connection: Connection): Promise<FixtureIds> {
  const suffix = randomUUID();
  await connection.beginTransaction();
  try {
    const usuario = await insertId(
      connection,
      `INSERT INTO usuarios (nome, email, tipo, nivel)
       VALUES (?, ?, 'cliente', 'iniciante')`,
      ["Integração fila", `fila-${suffix}@integration.invalid`],
    );
    const material = await insertId(
      connection,
      `INSERT INTO materiais (nome, tipo, cor, preco, status)
       VALUES (?, 'PLA', 'Teste', 0.1, 'disponivel')`,
      [`Material ${suffix}`],
    );
    const qualidade = await insertId(
      connection,
      `INSERT INTO qualidades (nome, altura, espessura, velocidade)
       VALUES (?, 0.2, 0.4, 60)`,
      [`Qualidade ${suffix}`],
    );
    const arquivo = await insertId(
      connection,
      `INSERT INTO arquivos (nome, tipo, caminho, tamanho_mb)
       VALUES (?, 'stl', ?, 0.001)`,
      [`arquivo-${suffix}.stl`, `integration/${suffix}.stl`],
    );
    const pedidos: number[] = [];
    for (let index = 0; index < 3; index += 1) {
      pedidos.push(await insertId(
        connection,
        `INSERT INTO pedidos (
           nome, status, id_usuario, id_material, id_qualidade, id_arquivo,
           tempo_gcode_horas, prazo_entrega_horas
         ) VALUES (?, 'na_fila', ?, ?, ?, ?, 1, 24)`,
        [`Pedido ${suffix}-${index}`, usuario, material, qualidade, arquivo],
      ));
    }
    const impressora = await insertId(
      connection,
      `INSERT INTO impressoras (
         nome, modelo, possui_cfs, largura_mesa_mm, profundidade_mesa_mm,
         status, api
       ) VALUES (?, 'Integração', 0, 220, 220, 'Ociosa', 'DUMMY')`,
      [`Impressora ${suffix}`],
    );
    await connection.execute(
      `INSERT INTO impressora_slots_filamento (id_impressora, numero_slot, id_material)
       VALUES (?, 1, ?)`,
      [impressora, material],
    );

    await connection.commit();
    return { usuario, material, qualidade, arquivo, pedidos, impressora };
  } catch (error) {
    await connection.rollback();
    throw error;
  }
}

function alocacao(
  idPedido: number,
  idImpressora: number,
  posicaoFila: number,
) {
  return {
    idPedido,
    idImpressora,
    posicaoFila,
    numeroSlotPlanejado: 1,
    requerTrocaManual: false,
    statusInicial: "na_fila" as const,
    inicioPrevistoHoras: posicaoFila - 1,
    conclusaoPrevistaHoras: posicaoFila,
    custo: 0,
    setupHoras: 0,
    riscoEsperadoHoras: 0,
    tempoTotalHoras: 1,
    atrasoHoras: 0,
    violouPrazo: false,
    violouTempoMaximoEspera: false,
  };
}

describe("PedidoImpressoraRepository — integração MySQL", {
  skip: !RUN_INTEGRATION,
  concurrency: 1,
}, () => {
  let connection: Connection;
  let fixture: FixtureIds;
  let repository: InstanceType<
    typeof import("./pedidoImpressora.repository").PedidoImpressoraRepository
  >;
  let RepositoryConstructor: typeof import(
    "./pedidoImpressora.repository"
  ).PedidoImpressoraRepository;
  let repositoryPool: typeof import("../../database/connection").db;

  before(async () => {
    const config = integrationConfig();

    // O repository usa a configuração DB_* da aplicação. Ela só é apontada
    // para o alvo explicitamente validado depois de a suíte sair do skip.
    process.env.DB_HOST = config.host;
    process.env.DB_PORT = String(config.port);
    process.env.DB_USER = config.user;
    process.env.DB_PASSWORD = config.password;
    process.env.DB_NAME = config.database;
    ({ PedidoImpressoraRepository: RepositoryConstructor } = await import(
      "./pedidoImpressora.repository"
    ));
    ({ db: repositoryPool } = await import("../../database/connection"));
    repository = new RepositoryConstructor();

    // A suíte nunca cria nem inicializa schema. O operador deve apontar para um
    // banco descartável já inicializado pelo db:init e confirmar o nome *_test.
    connection = await mysql.createConnection(config);
    await connection.query("SET SESSION time_zone = '+00:00'");
    const [databaseRows]: any = await connection.query("SELECT DATABASE() AS databaseName");
    assert.equal(databaseRows[0]?.databaseName, config.database);
    const [columnRows]: any = await connection.execute(
      `SELECT COLUMN_NAME AS columnName, EXTRA AS extra,
              GENERATION_EXPRESSION AS generationExpression
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'pedido_impressora'`,
      [config.database],
    );
    const columns = new Map<string, {
      extra?: unknown;
      generationExpression?: unknown;
    }>(
      (columnRows as any[]).map((row) => [String(row.columnName), row] as const),
    );
    for (const requiredColumn of [
      "id_pedido_ativo",
      "numero_slot_planejado",
      "requer_troca_manual",
      "tentativas_inicio",
      "proxima_tentativa_em",
    ]) {
      assert.ok(
        columns.has(requiredColumn),
        `Schema de integração não inicializado: falta pedido_impressora.${requiredColumn}.`,
      );
    }

    const generatedColumn = columns.get("id_pedido_ativo");
    assert.match(String(generatedColumn?.extra), /STORED GENERATED/i);
    assert.match(String(generatedColumn?.generationExpression), /id_pedido/i);
    const [indexRows]: any = await connection.execute(
      `SELECT NON_UNIQUE AS nonUnique, COLUMN_NAME AS columnName
       FROM information_schema.STATISTICS
       WHERE TABLE_SCHEMA = ?
         AND TABLE_NAME = 'pedido_impressora'
         AND INDEX_NAME = 'uq_pedido_impressora_pedido_ativo'`,
      [config.database],
    );
    assert.deepEqual(
      indexRows.map((row: any) => ({
        nonUnique: Number(row.nonUnique),
        columnName: String(row.columnName),
      })),
      [{ nonUnique: 0, columnName: "id_pedido_ativo" }],
      "O schema deve ter um índice unique isolado sobre id_pedido_ativo.",
    );

    const [activeRows]: any = await connection.query(
      `SELECT COUNT(*) AS total
       FROM pedido_impressora
       WHERE status IN ('na_fila', 'reservado', 'aguardando_filamento', 'em_impressao')`,
    );
    assert.equal(
      Number(activeRows[0]?.total),
      0,
      "O banco dedicado deve iniciar sem planejamento ativo; a substituição é global.",
    );
    fixture = await createFixture(connection);
  });

  after(async () => {
    try {
      if (typeof connection !== "undefined" && typeof fixture !== "undefined") {
        await connection.execute("DELETE FROM impressoras WHERE id = ?", [fixture.impressora]);
        await connection.execute("DELETE FROM pedidos WHERE id IN (?, ?, ?)", fixture.pedidos);
        await connection.execute("DELETE FROM arquivos WHERE id = ?", [fixture.arquivo]);
        await connection.execute("DELETE FROM qualidades WHERE id = ?", [fixture.qualidade]);
        await connection.execute("DELETE FROM materiais WHERE id = ?", [fixture.material]);
        await connection.execute("DELETE FROM usuarios WHERE id = ?", [fixture.usuario]);
      }
    } finally {
      if (typeof connection !== "undefined") await connection.end();
      if (typeof repositoryPool !== "undefined") await repositoryPool.end();
    }
  });

  test("coluna gerada impede duas alocações ativas para o mesmo pedido", async () => {
    const pedido = fixture.pedidos[0];
    await connection.execute("DELETE FROM pedido_impressora WHERE id_pedido = ?", [pedido]);
    await connection.execute(
      `INSERT INTO pedido_impressora (
         id_pedido, id_impressora, status, posicao_fila,
         numero_slot_planejado, requer_troca_manual
       ) VALUES (?, ?, 'na_fila', 1, 1, 0)`,
      [pedido, fixture.impressora],
    );

    const [rows]: any = await connection.execute(
      "SELECT id_pedido_ativo AS idPedidoAtivo FROM pedido_impressora WHERE id_pedido = ?",
      [pedido],
    );
    assert.equal(Number(rows[0].idPedidoAtivo), pedido);

    await assert.rejects(
      () => connection.execute(
        `INSERT INTO pedido_impressora (
           id_pedido, id_impressora, status, posicao_fila,
           numero_slot_planejado, requer_troca_manual
         ) VALUES (?, ?, 'reservado', 2, 1, 0)`,
        [pedido, fixture.impressora],
      ),
      (error: any) => error?.code === "ER_DUP_ENTRY" || error?.errno === 1062,
    );

    for (const status of ["reservado", "aguardando_filamento", "em_impressao"] as const) {
      await connection.execute(
        "UPDATE pedido_impressora SET status = ? WHERE id_pedido = ?",
        [status, pedido],
      );
      const [activeRows]: any = await connection.execute(
        "SELECT id_pedido_ativo AS idPedidoAtivo FROM pedido_impressora WHERE id_pedido = ?",
        [pedido],
      );
      assert.equal(Number(activeRows[0].idPedidoAtivo), pedido);
    }

    await connection.execute(
      "UPDATE pedido_impressora SET status = 'cancelado' WHERE id_pedido = ?",
      [pedido],
    );
    const [inactiveRows]: any = await connection.execute(
      "SELECT id_pedido_ativo AS idPedidoAtivo FROM pedido_impressora WHERE id_pedido = ?",
      [pedido],
    );
    assert.equal(inactiveRows[0].idPedidoAtivo, null);
  });

  test("dois workers com SKIP LOCKED não reservam a mesma alocação", async () => {
    const pedidos = fixture.pedidos.slice(0, 2);
    await connection.execute(
      "DELETE FROM pedido_impressora WHERE id_pedido IN (?, ?)",
      pedidos,
    );
    await connection.execute(
      "UPDATE impressoras SET status = 'Ociosa', id_pedido_atual = NULL WHERE id = ?",
      [fixture.impressora],
    );
    await repository.substituirPlanejamento([
      alocacao(pedidos[0], fixture.impressora, 1),
      alocacao(pedidos[1], fixture.impressora, 2),
    ]);

    const worker1 = new RepositoryConstructor();
    const worker2 = new RepositoryConstructor();
    const [reserva1, reserva2] = await Promise.all([
      worker1.reservarProximaAlocacao(fixture.impressora),
      worker2.reservarProximaAlocacao(fixture.impressora),
    ]);
    const reservas = [reserva1, reserva2].filter(
      (reserva): reserva is NonNullable<typeof reserva> => reserva !== null,
    );

    assert.equal(reservas.length, 1);
    assert.equal(new Set(reservas.map((reserva) => reserva.idAlocacao)).size, 1);
    assert.equal(reservas[0].idPedido, pedidos[0]);
    const planoAposCorrida = await repository.listarPlano({
      idImpressora: fixture.impressora,
    });
    assert.deepEqual(
      planoAposCorrida
        .filter((item) => pedidos.includes(item.idPedido))
        .map((item) => [item.idPedido, item.status]),
      [
        [pedidos[0], "reservado"],
        [pedidos[1], "na_fila"],
      ],
    );

    await repository.marcarAguardandoFilamento(
      reservas[0].idAlocacao,
      "liberação da fixture concorrente",
    );
  });

  test("replanejamento preserva item reservado", async () => {
    const pedidos = fixture.pedidos.slice(1, 3);
    await connection.execute(
      "DELETE FROM pedido_impressora WHERE id_pedido IN (?, ?)",
      pedidos,
    );
    await connection.execute(
      "UPDATE impressoras SET status = 'Ociosa', id_pedido_atual = NULL WHERE id = ?",
      [fixture.impressora],
    );
    await repository.substituirPlanejamento([
      alocacao(pedidos[0], fixture.impressora, 1),
      alocacao(pedidos[1], fixture.impressora, 2),
    ]);
    const reservado = await repository.reservarAlocacao(fixture.impressora, pedidos[0]);
    if (!reservado) throw new Error("A fixture não conseguiu reservar a alocação esperada.");

    await repository.substituirPlanejamento([
      alocacao(pedidos[1], fixture.impressora, 1),
    ]);

    const plano = await repository.listarPlano({ idImpressora: fixture.impressora });
    const itemReservado = plano.find((item: any) => item.id === reservado.idAlocacao);
    if (!itemReservado) throw new Error("O item reservado desapareceu durante o replanejamento.");
    assert.equal(itemReservado.status, "reservado");
    assert.equal(itemReservado.idPedido, pedidos[0]);

    await repository.marcarAguardandoFilamento(
      reservado.idAlocacao,
      "liberação da fixture de replanejamento",
    );
  });
});
