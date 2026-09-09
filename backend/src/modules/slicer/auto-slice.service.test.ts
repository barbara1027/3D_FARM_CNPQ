import assert from "node:assert/strict";
import { test } from "node:test";
import { resolverStatusAposAnalise } from "./auto-slice.service";
import { DadosBaseTemporal } from "../pedidos/baseTemporal.service";

function baseTemporalValida(overrides: Partial<DadosBaseTemporal> = {}): DadosBaseTemporal {
  return {
    tempoGcodeHoras: 2,
    tempoExecFarmHoras: 2.3,
    etaHorasEstimado: 10,
    etaCalculadoEm: "2026-01-01 08:00:00",
    prazoEntregaHoras: 10,
    prazoEntrega: "2026-01-01 18:00:00",
    prazoEntregaOriginal: "2026-01-01 18:00:00",
    limiteInicioImpressao: "2026-01-01 16:00:00",
    tempoMaximoEsperaHoras: 7.7,
    bufferPrioridadeHoras: 0.5,
    bufferSegurancaHoras: 1.5,
    ...overrides,
  };
}

test("pedido de admin com base temporal valida entra direto na fila", () => {
  const status = resolverStatusAposAnalise("admin", false, baseTemporalValida());
  assert.equal(status, "na_fila");
});

test("pedido de admin com base temporal incompleta e bloqueado antes de entrar na fila", () => {
  assert.throws(
    () => resolverStatusAposAnalise("admin", false, baseTemporalValida({ etaHorasEstimado: null })),
    /base temporal válida/i,
  );
});

test("pedido de admin com ETA em falha (nao calculado) tambem e bloqueado", () => {
  assert.throws(
    () =>
      resolverStatusAposAnalise(
        "admin",
        false,
        baseTemporalValida({ etaCalculadoEm: null, prazoEntrega: null }),
      ),
    /base temporal válida/i,
  );
});

test("cliente com peca complexa vai para aguardando_revisao, mesmo com base temporal valida", () => {
  const status = resolverStatusAposAnalise("cliente", true, baseTemporalValida());
  assert.equal(status, "aguardando_revisao");
});

test("cliente com peca simples vai para aguardando_pagamento", () => {
  const status = resolverStatusAposAnalise("cliente", false, baseTemporalValida());
  assert.equal(status, "aguardando_pagamento");
});

test("cliente nao e bloqueado por base temporal incompleta (fila so e protegida no pagamento)", () => {
  const status = resolverStatusAposAnalise(
    "cliente",
    false,
    baseTemporalValida({ prazoEntrega: null }),
  );
  assert.equal(status, "aguardando_pagamento");
});
