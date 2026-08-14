import assert from "node:assert/strict";
import { test } from "node:test";
import { db } from "../../database/connection";
import { JobImpressaoRepository } from "./jobsImpressao.repository";

function installExecute(handler: (sql: string, params?: any[]) => Promise<any>) {
  const original = (db as any).execute;
  (db as any).execute = handler;
  return () => { (db as any).execute = original; };
}

test("criarJobsParaPedido insere exatamente um job por unidade de quantidade", async () => {
  let selectCalls = 0;
  const inserts: any[][] = [];
  const restore = installExecute(async (sql: string, params?: any[]) => {
    if (/SELECT 1 FROM jobs_impressao/.test(sql)) {
      selectCalls += 1;
      return [[], []];
    }
    if (/INSERT INTO jobs_impressao/.test(sql)) {
      inserts.push(params ?? []);
      return [{ insertId: inserts.length }, []];
    }
    throw new Error(`SQL inesperado no teste: ${sql}`);
  });
  try {
    await new JobImpressaoRepository().criarJobsParaPedido(10, 3, 2.5);
    assert.equal(selectCalls, 1);
    assert.equal(inserts.length, 3);
    assert.deepEqual(inserts.map((params) => params[1]), [1, 2, 3]);
    assert.deepEqual(inserts.map((params) => params[0]), [10, 10, 10]);
    assert.deepEqual(inserts.map((params) => params[2]), [2.5, 2.5, 2.5]);
  } finally {
    restore();
  }
});

test("criarJobsParaPedido eh idempotente: nao duplica se o pedido ja possui jobs", async () => {
  let insertCalls = 0;
  const restore = installExecute(async (sql: string) => {
    if (/SELECT 1 FROM jobs_impressao/.test(sql)) return [[{ existe: 1 }], []];
    if (/INSERT INTO jobs_impressao/.test(sql)) {
      insertCalls += 1;
      return [{ insertId: 1 }, []];
    }
    throw new Error(`SQL inesperado no teste: ${sql}`);
  });
  try {
    await new JobImpressaoRepository().criarJobsParaPedido(10, 5, 1);
    assert.equal(insertCalls, 0);
  } finally {
    restore();
  }
});

test("quantidade invalida (zero, negativa ou fracionaria) sempre cria pelo menos 1 job", async () => {
  const inserts: any[][] = [];
  const restore = installExecute(async (sql: string, params?: any[]) => {
    if (/SELECT 1 FROM jobs_impressao/.test(sql)) return [[], []];
    if (/INSERT INTO jobs_impressao/.test(sql)) {
      inserts.push(params ?? []);
      return [{ insertId: inserts.length }, []];
    }
    throw new Error(`SQL inesperado no teste: ${sql}`);
  });
  try {
    await new JobImpressaoRepository().criarJobsParaPedido(11, 0, null);
    assert.equal(inserts.length, 1);
  } finally {
    restore();
  }
});

test("recriarJobsParaPedido abre um novo lote mesmo com jobs anteriores existentes", async () => {
  let insertCalls = 0;
  const restore = installExecute(async (sql: string) => {
    if (/INSERT INTO jobs_impressao/.test(sql)) {
      insertCalls += 1;
      return [{ insertId: insertCalls }, []];
    }
    throw new Error(`SQL inesperado no teste: ${sql}`);
  });
  try {
    await new JobImpressaoRepository().recriarJobsParaPedido(10, 2, 3);
    assert.equal(insertCalls, 2);
  } finally {
    restore();
  }
});
