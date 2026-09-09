import assert from "node:assert/strict";
import { test } from "node:test";
import { construirPayloadAtualizacaoPedido } from "./pedidos.controller";

test("cliente comum nao consegue alterar campos internos do pedido", () => {
  const payload = construirPayloadAtualizacaoPedido(false, {
    preco: 999,
    tempoGcodeHoras: 1,
    prazoEntregaHoras: 1,
    etaHorasEstimado: 1,
    prioridadePaga: true,
    idMaterial: 5,
    idQualidade: 2,
    idArquivo: 3,
    parametros: { infill: 50 },
    descricao: "nova descricao",
  });

  assert.equal(payload.descricao, "nova descricao");
  for (const campoInterno of [
    "preco", "tempoGcodeHoras", "prazoEntregaHoras", "etaHorasEstimado",
    "prioridadePaga", "idMaterial", "idQualidade", "idArquivo", "parametros",
  ]) {
    assert.equal(campoInterno in payload, false, `${campoInterno} nao deveria estar no payload do cliente`);
  }
});

test("admin pode alterar campos fisicos mas nao os calculados pelo pipeline", () => {
  const payload = construirPayloadAtualizacaoPedido(true, {
    idMaterial: 5,
    idQualidade: 2,
    idArquivo: 3,
    parametros: { infill: 50 },
    preco: 999,
    prioridadePaga: true,
    tempoGcodeHoras: 1,
  });

  assert.equal(payload.idMaterial, 5);
  assert.equal(payload.idQualidade, 2);
  assert.equal(payload.idArquivo, 3);
  assert.deepEqual(payload.parametros, { infill: 50 });
  assert.equal("preco" in payload, false);
  assert.equal("prioridadePaga" in payload, false);
  assert.equal("tempoGcodeHoras" in payload, false);
});

test("cliente pode solicitar cancelamento via status", () => {
  const payload = construirPayloadAtualizacaoPedido(false, { status: "cancelado" });
  assert.equal(payload.status, "cancelado");
});
