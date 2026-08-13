import assert from "node:assert/strict";
import { test } from "node:test";
import {
  FilaOtimizacaoService,
  ImpressoraOtimizacao,
  PedidoOtimizacao,
  PESO_ATRASO_PRIORIDADE_PAGA,
} from "./filaOtimizacao.service";

const MATERIAL_ALVO = 10;
const OUTRO_MATERIAL = 20;

function pedido(
  id: number,
  overrides: Partial<PedidoOtimizacao> = {},
): PedidoOtimizacao {
  return {
    id,
    idMaterial: MATERIAL_ALVO,
    tempoGcodeHoras: 1,
    prazoEntregaHoras: 24,
    tempoMaximoEsperaHoras: null,
    limiteInicioImpressao: null,
    criadoEm: new Date(Date.UTC(2026, 0, 1, 0, id)).toISOString(),
    prioridadePaga: false,
    ...overrides,
  };
}

function impressora(
  id: number,
  overrides: Partial<ImpressoraOtimizacao> = {},
): ImpressoraOtimizacao {
  return {
    id,
    idMaterialAtual: MATERIAL_ALVO,
    possuiCfs: false,
    slots: [{ numeroSlot: 1, idMaterial: MATERIAL_ALVO }],
    eficiencia: 1,
    taxaErroRecente: 0,
    tempoParaFicarLivreHoras: 0,
    capacidadeDiaHoras: 24,
    ...overrides,
  };
}

function montar(
  pedidos: PedidoOtimizacao[],
  impressoras: ImpressoraOtimizacao[],
  horasOperador = 4,
) {
  return new FilaOtimizacaoService().montarFilasDiarias(
    pedidos,
    impressoras,
    horasOperador,
  );
}

test("prioridade paga avanca quando preserva o prazo do pedido normal", () => {
  const normal = pedido(1, {
    criadoEm: "2026-01-01T00:00:00.000Z",
    prazoEntregaHoras: 2,
  });
  const prioritario = pedido(2, {
    criadoEm: "2026-01-01T01:00:00.000Z",
    prioridadePaga: true,
  });

  const alocacoes = montar([prioritario, normal], [impressora(1)]);

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [2, 1]);
  assert.equal(alocacoes[1].conclusaoPrevistaHoras, 2);
  assert.equal(alocacoes[1].violouPrazo, false);
});

test("prioridade paga nao avanca quando faria o pedido normal perder o prazo", () => {
  const normal = pedido(1, {
    criadoEm: "2026-01-01T00:00:00.000Z",
    tempoGcodeHoras: 2,
    prazoEntregaHoras: 2,
  });
  const prioritario = pedido(2, {
    criadoEm: "2026-01-01T01:00:00.000Z",
    prioridadePaga: true,
  });

  const alocacoes = montar([prioritario, normal], [impressora(1)]);

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [1, 2]);
  assert.equal(alocacoes[0].violouPrazo, false);
});

test("pedidos equivalentes preservam FIFO com id como desempate", () => {
  const mesmaData = "2026-01-01T00:00:00.000Z";
  const alocacoes = montar(
    [
      pedido(4, { criadoEm: mesmaData }),
      pedido(3, { criadoEm: mesmaData }),
    ],
    [impressora(1)],
  );

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [3, 4]);
});

test("pedidos pagos equivalentes tambem preservam FIFO", () => {
  const alocacoes = montar(
    [
      pedido(2, {
        criadoEm: "2026-01-01T01:00:00.000Z",
        prioridadePaga: true,
      }),
      pedido(1, {
        criadoEm: "2026-01-01T00:00:00.000Z",
        prioridadePaga: true,
      }),
    ],
    [impressora(1)],
  );

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [1, 2]);
});

test("em sobrecarga inevitavel, usa atraso ponderado para antecipar prioridade paga", () => {
  const alocacoes = montar(
    [
      pedido(1, { tempoGcodeHoras: 10, prazoEntregaHoras: 0 }),
      pedido(2, { tempoGcodeHoras: 1, prazoEntregaHoras: 0, prioridadePaga: true }),
    ],
    [impressora(1)],
  );

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [2, 1]);
  assert.deepEqual(alocacoes.map((item) => item.atrasoHoras), [1, 11]);
  assert.equal(
    alocacoes.reduce(
      (total, item) =>
        total + item.atrasoHoras * (item.idPedido === 2 ? PESO_ATRASO_PRIORIDADE_PAGA : 1),
      0,
    ),
    13,
  );
});

test("em sobrecarga nao antecipa prioridade paga quando pioraria o atraso ponderado", () => {
  const alocacoes = montar(
    [
      pedido(1, { tempoGcodeHoras: 1, prazoEntregaHoras: 0 }),
      pedido(2, { tempoGcodeHoras: 10, prazoEntregaHoras: 0, prioridadePaga: true }),
    ],
    [impressora(1)],
  );

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [1, 2]);
});

test("pedido fora da capacidade diaria nao congela a ponderacao dos ja alocados", () => {
  const alocacoes = montar(
    [
      pedido(1, { tempoGcodeHoras: 10, prazoEntregaHoras: 0 }),
      pedido(2, { tempoGcodeHoras: 1, prazoEntregaHoras: 0, prioridadePaga: true }),
      pedido(3, { tempoGcodeHoras: 100, prazoEntregaHoras: 0 }),
    ],
    [impressora(1, { capacidadeDiaHoras: 11 })],
  );

  assert.deepEqual(alocacoes.map((item) => item.idPedido), [2, 1]);
});

test("CFS encontra material carregado no slot 2", () => {
  const [alocacao] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        slots: [
          { numeroSlot: 1, idMaterial: OUTRO_MATERIAL },
          { numeroSlot: 2, idMaterial: MATERIAL_ALVO },
        ],
      }),
    ],
  );

  assert.equal(alocacao.numeroSlotPlanejado, 2);
  assert.equal(alocacao.requerTrocaManual, false);
  assert.equal(alocacao.statusInicial, "na_fila");
  assert.equal(alocacao.setupHoras, 0);
});

test("CFS encontra material carregado no slot 4", () => {
  const [alocacao] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        slots: [
          { numeroSlot: 1, idMaterial: OUTRO_MATERIAL },
          { numeroSlot: 4, idMaterial: MATERIAL_ALVO },
        ],
      }),
    ],
  );

  assert.equal(alocacao.numeroSlotPlanejado, 4);
  assert.equal(alocacao.requerTrocaManual, false);
  assert.equal(alocacao.setupHoras, 0);
});

test("prefere impressora que ja possui o material", () => {
  const [alocacao] = montar(
    [pedido(1)],
    [
      impressora(1, {
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [{ numeroSlot: 1, idMaterial: OUTRO_MATERIAL }],
      }),
      impressora(2, {
        possuiCfs: true,
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [{ numeroSlot: 4, idMaterial: MATERIAL_ALVO }],
      }),
    ],
  );

  assert.equal(alocacao.idImpressora, 2);
  assert.equal(alocacao.numeroSlotPlanejado, 4);
  assert.equal(alocacao.requerTrocaManual, false);
});

test("material repetido no CFS escolhe deterministicamente o menor slot", () => {
  const [alocacao] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        slots: [
          { numeroSlot: 4, idMaterial: MATERIAL_ALVO },
          { numeroSlot: 2, idMaterial: MATERIAL_ALVO },
        ],
      }),
    ],
  );

  assert.equal(alocacao.numeroSlotPlanejado, 2);
});

test("impressora sem CFS ignora material no slot 2", () => {
  const [alocacao] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: false,
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [
          { numeroSlot: 1, idMaterial: OUTRO_MATERIAL },
          { numeroSlot: 2, idMaterial: MATERIAL_ALVO },
        ],
      }),
    ],
  );

  assert.equal(alocacao.numeroSlotPlanejado, null);
  assert.equal(alocacao.requerTrocaManual, true);
  assert.equal(alocacao.statusInicial, "aguardando_filamento");
  assert.equal(alocacao.setupHoras, 0.5);
});

test("material ausente permanece planejado aguardando filamento", () => {
  const alocacoes = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [{ numeroSlot: 3, idMaterial: OUTRO_MATERIAL }],
      }),
    ],
    0,
  );

  assert.equal(alocacoes.length, 1);
  assert.equal(alocacoes[0].numeroSlotPlanejado, null);
  assert.equal(alocacoes[0].requerTrocaManual, true);
  assert.equal(alocacoes[0].statusInicial, "aguardando_filamento");
  assert.equal(alocacoes[0].setupHoras, 0.25);
});

test("espera por filamento nao ocupa capacidade nem adia pedido executavel", () => {
  const alocacoes = montar(
    [
      pedido(1, { idMaterial: OUTRO_MATERIAL }),
      pedido(2, { idMaterial: MATERIAL_ALVO }),
    ],
    [impressora(1, { capacidadeDiaHoras: 1 })],
  );

  assert.equal(alocacoes.length, 2);
  assert.deepEqual(
    alocacoes.map((alocacao) => [alocacao.idPedido, alocacao.statusInicial]),
    [
      [1, "aguardando_filamento"],
      [2, "na_fila"],
    ],
  );
  assert.equal(alocacoes[1].inicioPrevistoHoras, 0);
  assert.equal(alocacoes[1].conclusaoPrevistaHoras, 1);
  assert.deepEqual(alocacoes.map((alocacao) => alocacao.posicaoFila), [1, 2]);
});

test("pedido aguardando e persistido mesmo quando sua duracao excede a capacidade diaria", () => {
  const alocacoes = montar(
    [pedido(1, { idMaterial: OUTRO_MATERIAL, tempoGcodeHoras: 10 })],
    [impressora(1, { capacidadeDiaHoras: 1 })],
  );

  assert.equal(alocacoes.length, 1);
  assert.equal(alocacoes[0].statusInicial, "aguardando_filamento");
});

test("material carregado posteriormente reativa a espera com o slot correto", () => {
  const pedidoAlvo = pedido(1);
  const base = impressora(1, {
    possuiCfs: true,
    idMaterialAtual: OUTRO_MATERIAL,
    slots: [{ numeroSlot: 1, idMaterial: OUTRO_MATERIAL }],
  });

  const [antes] = montar([pedidoAlvo], [base]);
  const [depois] = montar(
    [pedidoAlvo],
    [{ ...base, slots: [...(base.slots ?? []), { numeroSlot: 3, idMaterial: MATERIAL_ALVO }] }],
  );

  assert.equal(antes.statusInicial, "aguardando_filamento");
  assert.equal(antes.numeroSlotPlanejado, null);
  assert.equal(depois.statusInicial, "na_fila");
  assert.equal(depois.numeroSlotPlanejado, 3);
  assert.equal(depois.requerTrocaManual, false);
});

test("prefere candidato executavel a uma espera com termino hipotetico menor", () => {
  const [alocacao] = montar(
    [pedido(1, { prazoEntregaHoras: 0, prioridadePaga: true })],
    [
      impressora(1, {
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [{ numeroSlot: 1, idMaterial: OUTRO_MATERIAL }],
      }),
      impressora(2, { tempoParaFicarLivreHoras: 0.8 }),
    ],
  );

  assert.equal(alocacao.idImpressora, 2);
  assert.equal(alocacao.statusInicial, "na_fila");
});

test("CFS com algum slot vazio usa setup de carga, nao de substituicao", () => {
  const [comSlotVazio] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        slots: [{ numeroSlot: 3, idMaterial: OUTRO_MATERIAL }],
      }),
    ],
  );
  const [semSlotVazio] = montar(
    [pedido(1)],
    [
      impressora(1, {
        possuiCfs: true,
        slots: [1, 2, 3, 4].map((numeroSlot) => ({
          numeroSlot,
          idMaterial: OUTRO_MATERIAL,
        })),
      }),
    ],
  );

  assert.equal(comSlotVazio.setupHoras, 0.25);
  assert.equal(semSlotVazio.setupHoras, 0.5);
});

test("saldo diario limita apenas a capacidade executavel restante", () => {
  const alocacoes = montar(
    [pedido(1), pedido(2)],
    [impressora(1, { capacidadeDiaHoras: 8, horasUsadasHoje: 7 })],
  );

  assert.deepEqual(alocacoes.map((alocacao) => alocacao.idPedido), [1]);
});

test("material manual ainda não carregado não torna pedidos seguintes executáveis", () => {
  const alocacoes = montar(
    [pedido(1), pedido(2)],
    [
      impressora(1, {
        possuiCfs: false,
        idMaterialAtual: OUTRO_MATERIAL,
        slots: [{ numeroSlot: 1, idMaterial: OUTRO_MATERIAL }],
      }),
    ],
  );

  assert.equal(alocacoes.length, 2);
  assert.deepEqual(
    alocacoes.map((alocacao) => alocacao.statusInicial),
    ["aguardando_filamento", "aguardando_filamento"],
  );
  assert.deepEqual(
    alocacoes.map((alocacao) => alocacao.numeroSlotPlanejado),
    [null, null],
  );
});

test("atraso inevitavel de pedido pago recebe peso maior sem alterar setup ou risco", () => {
  const [alocacao] = montar(
    [
      pedido(1, {
        prioridadePaga: true,
        tempoGcodeHoras: 2,
        prazoEntregaHoras: 1,
      }),
    ],
    [impressora(1)],
  );

  assert.equal(alocacao.atrasoHoras, 1);
  assert.equal(alocacao.setupHoras, 0);
  assert.equal(alocacao.riscoEsperadoHoras, 0);
  assert.equal(alocacao.custo, PESO_ATRASO_PRIORIDADE_PAGA);
});
