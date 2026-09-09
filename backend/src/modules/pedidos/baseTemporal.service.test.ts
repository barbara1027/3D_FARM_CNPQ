import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DadosBaseTemporal,
  pedidoEstaProntoParaFila,
  preservarPrazoEntregaOriginal,
  validarBaseTemporalParaFila,
} from "./baseTemporal.service";

function baseValida(overrides: Partial<DadosBaseTemporal> = {}): DadosBaseTemporal {
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

test("pedido com todos os campos validos esta pronto para a fila", () => {
  assert.equal(pedidoEstaProntoParaFila(baseValida()), true);
});

test("validarBaseTemporalParaFila nao lanca quando os dados sao validos", () => {
  assert.doesNotThrow(() => validarBaseTemporalParaFila(baseValida()));
});

const camposObrigatoriosInvalidos: Array<[keyof DadosBaseTemporal, unknown]> = [
  ["tempoGcodeHoras", null],
  ["tempoGcodeHoras", 0],
  ["tempoGcodeHoras", -1],
  ["tempoExecFarmHoras", null],
  ["tempoExecFarmHoras", 0],
  ["etaHorasEstimado", null],
  ["etaHorasEstimado", 0],
  ["etaCalculadoEm", null],
  ["prazoEntrega", null],
  ["prazoEntregaOriginal", null],
  ["limiteInicioImpressao", null],
  ["prazoEntregaHoras", null],
  ["prazoEntregaHoras", -1],
  ["tempoMaximoEsperaHoras", null],
  ["tempoMaximoEsperaHoras", -1],
  ["bufferPrioridadeHoras", null],
  ["bufferPrioridadeHoras", -1],
  ["bufferSegurancaHoras", null],
  ["bufferSegurancaHoras", -1],
];

for (const [campo, valor] of camposObrigatoriosInvalidos) {
  test(`pedido invalido quando ${String(campo)} = ${String(valor)}`, () => {
    assert.equal(pedidoEstaProntoParaFila(baseValida({ [campo]: valor } as Partial<DadosBaseTemporal>)), false);
  });

  test(`validarBaseTemporalParaFila lanca quando ${String(campo)} = ${String(valor)}`, () => {
    assert.throws(
      () => validarBaseTemporalParaFila(baseValida({ [campo]: valor } as Partial<DadosBaseTemporal>)),
      /base temporal válida/i,
    );
  });
}

test("campos numericos zerados (limite de espera/buffer) sao aceitos, pois >= 0 e valido", () => {
  assert.equal(
    pedidoEstaProntoParaFila(
      baseValida({ tempoMaximoEsperaHoras: 0, bufferPrioridadeHoras: 0, bufferSegurancaHoras: 0 }),
    ),
    true,
  );
});

test("pedido pago sem eta calculado nao fica pronto para a fila (protege o webhook do Stripe)", () => {
  assert.equal(
    pedidoEstaProntoParaFila(baseValida({ etaHorasEstimado: null, etaCalculadoEm: null })),
    false,
  );
});

test("preservarPrazoEntregaOriginal mantem o valor ja existente", () => {
  assert.equal(
    preservarPrazoEntregaOriginal("2026-01-01 10:00:00", "2026-02-01 10:00:00"),
    "2026-01-01 10:00:00",
  );
});

test("preservarPrazoEntregaOriginal usa o valor recem-calculado quando nao havia nenhum antes", () => {
  assert.equal(preservarPrazoEntregaOriginal(null, "2026-02-01 10:00:00"), "2026-02-01 10:00:00");
  assert.equal(preservarPrazoEntregaOriginal(undefined, "2026-02-01 10:00:00"), "2026-02-01 10:00:00");
});
