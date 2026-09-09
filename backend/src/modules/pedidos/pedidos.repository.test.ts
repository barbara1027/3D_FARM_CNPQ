import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../database/connection";
import { PedidoRepository } from "./pedidos.repository";

function installConnection(execute: (sql: string) => Promise<any>) {
  const original = (db as any).getConnection;
  let commits = 0;
  let rollbacks = 0;
  const connection = {
    async beginTransaction() {},
    execute,
    async commit() { commits += 1; },
    async rollback() { rollbacks += 1; },
    release() {},
  };
  (db as any).getConnection = async () => connection;
  return {
    restore: () => { (db as any).getConnection = original; },
    get commits() { return commits; },
    get rollbacks() { return rollbacks; },
  };
}

function installExecute(execute: (sql: string, params?: any[]) => Promise<any>) {
  const original = (db as any).execute;
  (db as any).execute = execute;
  return () => { (db as any).execute = original; };
}

function linhaOtimizacaoValida(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    idMaterial: 10,
    tempoGcodeHoras: "2.00",
    tempoExecFarmHoras: "2.30",
    etaHorasEstimado: "10.00",
    etaCalculadoEm: "2026-01-01 08:00:00",
    prazoEntregaHoras: "10.00",
    prazoEntrega: "2026-01-01 18:00:00",
    prazoEntregaOriginal: "2026-01-01 18:00:00",
    limiteInicioImpressao: "2026-01-01 16:00:00",
    tempoMaximoEsperaHoras: "7.70",
    bufferPrioridadeHoras: "0.00",
    bufferSegurancaHoras: "2.00",
    criadoEm: new Date("2026-01-01T08:00:00Z"),
    prioridadePaga: 0,
    ...overrides,
  };
}

test("repository rejeita status no update genérico antes de abrir transação", async () => {
  const resultado = await new PedidoRepository().update(1, { status: "na_fila" });
  assert.equal(resultado, "status_forbidden");
});

test("repository bloqueia mutação física sob lock quando existe execução ativa", async () => {
  let updateCalls = 0;
  const fake = installConnection(async (sql: string) => {
    if (/SELECT id FROM pedidos/.test(sql)) return [[{ id: 1 }], []];
    if (/FROM pedido_impressora/.test(sql)) return [[{ id: 8 }], []];
    if (/UPDATE pedidos/.test(sql)) updateCalls += 1;
    return [{ affectedRows: 1 }, []];
  });
  try {
    const resultado = await new PedidoRepository().update(1, { idMaterial: 2 });
    assert.equal(resultado, "execution_active");
    assert.equal(fake.rollbacks, 1);
    assert.equal(fake.commits, 0);
    assert.equal(updateCalls, 0);
  } finally {
    fake.restore();
  }
});

test("findPendentesParaOtimizacao mantem pedidos validos e ignora os sem base temporal completa", async () => {
  const invalida = linhaOtimizacaoValida({ id: 2, etaHorasEstimado: null, etaCalculadoEm: null });
  const restore = installExecute(async () => [[linhaOtimizacaoValida(), invalida], []]);
  try {
    const resultado = await new PedidoRepository().findPendentesParaOtimizacao();
    assert.deepEqual(resultado.map((p) => p.id), [1]);
    assert.equal(resultado[0].tempoGcodeHoras, 2);
    assert.equal(resultado[0].etaHorasEstimado, 10);
    assert.equal(resultado[0].prazoEntrega, "2026-01-01 18:00:00");
  } finally {
    restore();
  }
});

test("findPendentesParaOtimizacao nunca converte NULL em 0 para campos temporais obrigatorios", async () => {
  const comCampoNulo = linhaOtimizacaoValida({ tempoMaximoEsperaHoras: null });
  const restore = installExecute(async () => [[comCampoNulo], []]);
  try {
    const resultado = await new PedidoRepository().findPendentesParaOtimizacao();
    // NULL deve reprovar a validacao (pedido ignorado), nunca virar 0 e passar.
    assert.deepEqual(resultado, []);
  } finally {
    restore();
  }
});

test("repository não remove pedido com alocação ativa", async () => {
  let deleteCalls = 0;
  const fake = installConnection(async (sql: string) => {
    if (/SELECT status FROM pedidos/.test(sql)) return [[{ status: "falhou" }], []];
    if (/FROM pedido_impressora/.test(sql)) return [[{ id: 9 }], []];
    if (/FROM impressoras/.test(sql)) return [[], []];
    if (/DELETE FROM pedidos/.test(sql)) deleteCalls += 1;
    return [{ affectedRows: 1 }, []];
  });
  try {
    const resultado = await new PedidoRepository().delete(1);
    assert.equal(resultado, "execution_active");
    assert.equal(fake.rollbacks, 1);
    assert.equal(deleteCalls, 0);
  } finally {
    fake.restore();
  }
});
