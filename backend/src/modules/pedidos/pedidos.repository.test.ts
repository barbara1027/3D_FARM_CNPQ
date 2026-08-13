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
