import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../database/connection";
import { PedidoImpressoraRepository } from "./pedidoImpressora.repository";

interface FakeConnectionOptions {
  pedido?: any;
  alocacao?: any;
  affectedRows?: number;
}

function fakeConnection(options: FakeConnectionOptions = {}) {
  const sqls: string[] = [];
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  const connection = {
    async beginTransaction() {},
    async execute(sql: string) {
      sqls.push(sql);
      if (/FROM pedidos\s+WHERE id = \?\s+FOR UPDATE/s.test(sql)) {
        return [options.pedido ? [options.pedido] : [], []];
      }
      if (/FROM pedido_impressora pi\s+WHERE pi\.id_pedido = \?/s.test(sql)) {
        return [options.alocacao ? [options.alocacao] : [], []];
      }
      if (/FROM pedido_impressora pi[\s\S]+WHERE pi\.id = \?/s.test(sql)) {
        return [options.alocacao ? [options.alocacao] : [], []];
      }
      return [{ affectedRows: options.affectedRows ?? 1 }, []];
    },
    async commit() { commits += 1; },
    async rollback() { rollbacks += 1; },
    release() { releases += 1; },
  };
  return {
    connection,
    sqls,
    get commits() { return commits; },
    get rollbacks() { return rollbacks; },
    get releases() { return releases; },
  };
}

async function withConnection<T>(
  fake: ReturnType<typeof fakeConnection>,
  operation: () => Promise<T>,
): Promise<T> {
  const original = (db as any).getConnection;
  (db as any).getConnection = async () => fake.connection;
  try {
    return await operation();
  } finally {
    (db as any).getConnection = original;
  }
}

test("cancelamento bloqueia e cancela o pedido mesmo sem alocação ativa", async () => {
  const fake = fakeConnection({ pedido: { id: 41, status: "na_fila" } });
  const resultado = await withConnection(
    fake,
    () => new PedidoImpressoraRepository().cancelarPlanejamentoDoPedido(41),
  );

  assert.equal(resultado, "cancelado");
  assert.equal(fake.commits, 1);
  assert.equal(fake.rollbacks, 0);
  assert.equal(fake.releases, 1);
  assert.ok(fake.sqls.some((sql) => /SELECT id, status[\s\S]+FROM pedidos[\s\S]+FOR UPDATE/.test(sql)));
  assert.ok(fake.sqls.some((sql) => /UPDATE pedidos[\s\S]+SET status = 'cancelado'/.test(sql)));
});

test("cancelamento recusa reserva ativa sem alterar nenhum estado", async () => {
  const fake = fakeConnection({
    pedido: { id: 42, status: "na_fila" },
    alocacao: { id: 7, idImpressora: 3, status: "reservado" },
  });
  const resultado = await withConnection(
    fake,
    () => new PedidoImpressoraRepository().cancelarPlanejamentoDoPedido(42),
  );

  assert.equal(resultado, "execucao_ativa");
  assert.equal(fake.commits, 0);
  assert.equal(fake.rollbacks, 1);
  assert.equal(fake.sqls.some((sql) => /^UPDATE/m.test(sql.trim())), false);
});

test("início incerto preserva alocação e pedido e bloqueia somente a impressora", async () => {
  const fake = fakeConnection({
    alocacao: {
      id: 9,
      idPedido: 55,
      idImpressora: 4,
      status: "reservado",
      tentativasInicio: 0,
      statusPedido: "na_fila",
      idMaterialPedido: 2,
      statusImpressora: "Reservada",
      idPedidoAtual: 55,
    },
  });
  await withConnection(
    fake,
    () => new PedidoImpressoraRepository().bloquearReservaComInicioIncerto(9, "confirmação pendente"),
  );

  assert.equal(fake.commits, 1);
  assert.ok(fake.sqls.some((sql) => /UPDATE impressoras[\s\S]+SET status = 'Erro'/.test(sql)));
  assert.equal(fake.sqls.some((sql) => /UPDATE pedido_impressora/.test(sql)), false);
  assert.equal(fake.sqls.some((sql) => /UPDATE pedidos/.test(sql)), false);
  assert.ok(fake.sqls.some((sql) => /job_start_state_uncertain/.test(sql) || /INSERT INTO impressora_eventos/.test(sql)));
});

test("reconciliação confirma atomicamente uma reserva bloqueada em Erro", async () => {
  const fake = fakeConnection({
    alocacao: {
      id: 10,
      idPedido: 56,
      idImpressora: 5,
      status: "reservado",
      tentativasInicio: 0,
      statusPedido: "na_fila",
      idMaterialPedido: 2,
      statusImpressora: "Erro",
      idPedidoAtual: 56,
    },
  });
  await withConnection(
    fake,
    () => new PedidoImpressoraRepository().reconciliarInicioConfirmado(10, {
      jobRemotoId: "job-sanitizado",
      statusFisico: "Imprimindo",
    }),
  );

  assert.equal(fake.commits, 1);
  assert.ok(fake.sqls.some((sql) => /UPDATE pedido_impressora[\s\S]+em_impressao/.test(sql)));
  assert.ok(fake.sqls.some((sql) => /UPDATE pedidos SET status = 'em_impressao'/.test(sql)));
  assert.ok(fake.sqls.some((sql) => /UPDATE impressoras[\s\S]+SET status = 'Imprimindo'/.test(sql)));
});
