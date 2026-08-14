import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../database/connection";
import { registrarEventoUmaVez } from "./stripe.controller";

function installExecute(handler: (sql: string, params?: any[]) => Promise<any>) {
  const original = (db as any).execute;
  (db as any).execute = handler;
  return () => { (db as any).execute = original; };
}

test("registrarEventoUmaVez processa o evento na primeira vez", async () => {
  let inserts = 0;
  const restore = installExecute(async (sql: string) => {
    if (/INSERT INTO pagamentos/.test(sql)) {
      inserts += 1;
      return [{ insertId: 1 }, []];
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });
  try {
    const primeiraVez = await registrarEventoUmaVez("evt_123", 1, { amount_total: 1000 });
    assert.equal(primeiraVez, true);
    assert.equal(inserts, 1);
  } finally {
    restore();
  }
});

test("registrarEventoUmaVez nao reprocessa o mesmo event_id (webhook Stripe repetido)", async () => {
  const restore = installExecute(async (sql: string) => {
    if (/INSERT INTO pagamentos/.test(sql)) {
      const error: any = new Error("Duplicate entry 'evt_123' for key 'uq_pagamentos_event_id'");
      error.code = "ER_DUP_ENTRY";
      throw error;
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });
  try {
    const reentrega = await registrarEventoUmaVez("evt_123", 1, { amount_total: 1000 });
    assert.equal(reentrega, false);
  } finally {
    restore();
  }
});

test("registrarEventoUmaVez propaga erros que nao sao de chave duplicada", async () => {
  const restore = installExecute(async (sql: string) => {
    if (/INSERT INTO pagamentos/.test(sql)) {
      throw new Error("conexão perdida com o banco");
    }
    throw new Error(`SQL inesperado: ${sql}`);
  });
  try {
    await assert.rejects(
      () => registrarEventoUmaVez("evt_456", 1, { amount_total: 1000 }),
      /conexão perdida/,
    );
  } finally {
    restore();
  }
});
