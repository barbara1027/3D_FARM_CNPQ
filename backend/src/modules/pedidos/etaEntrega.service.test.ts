import assert from "node:assert/strict";
import { test } from "node:test";
import { EtaEntregaService } from "./etaEntrega.service";
import { ImpressoraOtimizacaoRow, ImpressoraRepository } from "../impressoras/impressoras.repository";
import { PedidoOtimizacaoRow, PedidoRepository } from "./pedidos.repository";

function impressora(overrides: Partial<ImpressoraOtimizacaoRow> = {}): ImpressoraOtimizacaoRow {
  return {
    id: 1,
    idMaterialAtual: null,
    possuiCfs: false,
    slots: [],
    eficiencia: 1,
    taxaErroRecente: 0,
    tempoParaFicarLivreHoras: 0,
    capacidadeDiaHoras: 8,
    horasUsadasHoje: 0,
    ...overrides,
  };
}

function pedidoPendente(overrides: Partial<PedidoOtimizacaoRow> = {}): PedidoOtimizacaoRow {
  return {
    id: 1,
    idMaterial: 1,
    tempoGcodeHoras: 2,
    prazoEntrega: "2026-01-01 18:00:00",
    prazoEntregaOriginal: "2026-01-01 18:00:00",
    prazoEntregaHoras: 10,
    limiteInicioImpressao: "2026-01-01 16:00:00",
    etaHorasEstimado: 10,
    etaCalculadoEm: "2026-01-01 08:00:00",
    tempoExecFarmHoras: 2.3,
    tempoMaximoEsperaHoras: 7.7,
    bufferPrioridadeHoras: 0,
    bufferSegurancaHoras: 2,
    criadoEm: new Date("2026-01-01T08:00:00Z"),
    prioridadePaga: false,
    dimensaoXMm: null,
    dimensaoYMm: null,
    dimensaoZMm: null,
    ...overrides,
  };
}

function servico(): EtaEntregaService {
  return new EtaEntregaService(
    {} as unknown as PedidoRepository,
    {} as unknown as ImpressoraRepository,
  );
}

const DATA_BASE = new Date(2026, 0, 5, 10, 0, 0);

test("ETA simples com uma impressora, sem fila e sem prioridade", () => {
  const resultado = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora()],
    DATA_BASE,
  );

  // tempoExecFarmHoras = (2/1 + 0.3) / (1-0) = 2.3
  assert.ok(Math.abs(resultado.tempoExecFarmHoras - 2.3) < 1e-9);
  assert.equal(resultado.bufferPrioridadeHoras, 0);
  // etaParcial = 2.3; bufferSeguranca = 2.3*0.2 = 0.46; eta = 2.76
  assert.ok(Math.abs(resultado.etaHorasEstimado - 2.76) < 1e-9);
  assert.ok(Math.abs(resultado.tempoMaximoEsperaHoras - 0.46) < 1e-9);
});

test("eficiencia menor que 1 aumenta o tempo de execucao na farm", () => {
  const base = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora({ eficiencia: 1 })],
    DATA_BASE,
  );
  const comEficienciaMenor = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora({ eficiencia: 0.5 })],
    DATA_BASE,
  );

  assert.ok(comEficienciaMenor.tempoExecFarmHoras > base.tempoExecFarmHoras);
  assert.ok(comEficienciaMenor.etaHorasEstimado > base.etaHorasEstimado);
});

test("taxa de erro aumenta o tempo esperado", () => {
  const semErro = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora({ taxaErroRecente: 0 })],
    DATA_BASE,
  );
  const comErro = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora({ taxaErroRecente: 0.2 })],
    DATA_BASE,
  );

  assert.ok(comErro.etaHorasEstimado > semErro.etaHorasEstimado);
});

test("workload pendente existente aumenta o ETA", () => {
  const semFila = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora()],
    DATA_BASE,
  );
  const comFila = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [pedidoPendente({ tempoGcodeHoras: 5 })],
    [impressora()],
    DATA_BASE,
  );

  assert.ok(comFila.etaHorasEstimado > semFila.etaHorasEstimado);
});

test("prioridade paga zera o buffer de prioridade quando ha fila", () => {
  const pendentes = [pedidoPendente({ tempoGcodeHoras: 5 })];
  const normal = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2, prioridadePaga: false },
    pendentes,
    [impressora()],
    DATA_BASE,
  );
  const prioritario = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2, prioridadePaga: true },
    pendentes,
    [impressora()],
    DATA_BASE,
  );

  assert.ok(normal.bufferPrioridadeHoras > 0);
  assert.equal(prioritario.bufferPrioridadeHoras, 0);
  assert.ok(prioritario.etaHorasEstimado < normal.etaHorasEstimado);
});

test("pedido normal recebe o buffer de prioridade proporcional a fila (fator padrao 0.1)", () => {
  const pendentes = [pedidoPendente({ tempoGcodeHoras: 5 })];
  const resultado = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2, prioridadePaga: false },
    pendentes,
    [impressora()],
    DATA_BASE,
  );

  const metricas = servico().calcularMetricasFarm([impressora()]);
  const tempoExecPendente = servico().calcularTempoExecFarm({ tempoGcodeHoras: 5 }, metricas);
  const tempoFilaHoras = (tempoExecPendente / metricas.capacidadeDiariaTotal) * metricas.jornadaHorasDia;

  assert.ok(Math.abs(resultado.bufferPrioridadeHoras - tempoFilaHoras * 0.1) < 1e-9);
});

test("buffer de seguranca sempre aumenta o eta em relacao ao eta parcial", () => {
  const resultado = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora()],
    DATA_BASE,
  );

  assert.ok(resultado.bufferSegurancaHoras > 0);
  const etaParcial = resultado.etaHorasEstimado - resultado.bufferSegurancaHoras;
  assert.ok(resultado.etaHorasEstimado > etaParcial);
});

test("limite de inicio de impressao nunca fica depois do prazo de entrega final", () => {
  const resultado = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [pedidoPendente({ tempoGcodeHoras: 6 })],
    [impressora()],
    DATA_BASE,
  );

  const limite = new Date(resultado.limiteInicioImpressao.replace(" ", "T"));
  const prazo = new Date(resultado.prazoEntrega.replace(" ", "T"));
  assert.ok(limite.getTime() <= prazo.getTime());
});

test("primeiro calculo define prazo_entrega_original igual ao prazo_entrega recem-calculado", () => {
  const resultado = servico().calcularEtaNovoPedido(
    { idMaterial: 1, tempoGcodeHoras: 2 },
    [],
    [impressora()],
    DATA_BASE,
  );

  assert.equal(resultado.prazoEntregaOriginal, resultado.prazoEntrega);
});

test("lanca erro quando nenhuma impressora tem capacidade disponivel", () => {
  assert.throws(
    () =>
      servico().calcularEtaNovoPedido(
        { idMaterial: 1, tempoGcodeHoras: 2 },
        [],
        [],
        DATA_BASE,
      ),
    /nenhuma impressora disponivel/i,
  );
});
