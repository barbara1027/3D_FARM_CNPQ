import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DeletePedidoResult,
  Pedido,
  PedidoRepository,
  UpdatePedidoRepositoryDTO,
  UpdatePedidoResult,
} from "./pedidos.repository";
import { PedidoService } from "./pedidos.service";
import {
  PedidoImpressoraRepository,
  ResultadoCancelamentoPedido,
} from "../fila/pedidoImpressora.repository";

function pedidoBase(overrides: Partial<Pedido> = {}): Pedido {
  return {
    id: 1,
    nome: "Pedido seguro",
    preco: 10,
    descricao: null,
    status: "na_fila",
    idUsuario: 1,
    idMaterial: 1,
    idQualidade: 1,
    idArquivo: 1,
    parametros: null,
    quantidade: 1,
    gcodePath: "pedido.gcode",
    tempoEstimadoS: 60,
    materialGramas: 1,
    scoreComplexidade: null,
    motivoComplexidade: null,
    precoBase: null,
    taxaComplexidade: null,
    taxaStripe: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    tempoGcodeHoras: 1,
    prazoEntregaHoras: 24,
    prazoEntrega: null,
    etaHorasEstimado: null,
    etaCalculadoEm: null,
    prazoEntregaOriginal: null,
    limiteInicioImpressao: null,
    prioridadePaga: false,
    tempoMaximoEsperaHoras: null,
    bufferPrioridadeHoras: null,
    bufferSegurancaHoras: null,
    tempoExecFarmHoras: null,
    ...overrides,
  };
}

class FakePedidoRepository {
  pedido = pedidoBase();
  updateResult: UpdatePedidoResult = "updated";
  deleteResult: DeletePedidoResult = "deleted";
  readonly updates: UpdatePedidoRepositoryDTO[] = [];

  async findById(id: number): Promise<Pedido | null> {
    return id === this.pedido.id ? { ...this.pedido } : null;
  }

  async update(_id: number, data: UpdatePedidoRepositoryDTO): Promise<UpdatePedidoResult> {
    this.updates.push({ ...data });
    if (this.updateResult === "updated") Object.assign(this.pedido, data);
    return this.updateResult;
  }

  async delete(): Promise<DeletePedidoResult> {
    return this.deleteResult;
  }
}

class FakePedidoImpressoraRepository {
  cancelResult: ResultadoCancelamentoPedido = "cancelado";
  cancelCalls = 0;

  async cancelarPlanejamentoDoPedido(): Promise<ResultadoCancelamentoPedido> {
    this.cancelCalls += 1;
    return this.cancelResult;
  }
}

function harness() {
  const pedidos = new FakePedidoRepository();
  const fila = new FakePedidoImpressoraRepository();
  const service = new PedidoService(
    pedidos as unknown as PedidoRepository,
    fila as unknown as PedidoImpressoraRepository,
  );
  return { pedidos, fila, service };
}

test("update genérico rejeita todas as transições operacionais exceto cancelamento central", async () => {
  for (const status of ["analisando", "aguardando_pagamento", "na_fila", "em_impressao", "concluido", "falhou"] as const) {
    const { service, pedidos, fila } = harness();
    await assert.rejects(
      () => service.atualizar(1, { status }),
      /transições da fila/i,
    );
    assert.equal(pedidos.updates.length, 0);
    assert.equal(fila.cancelCalls, 0);
  }
});

test("cancelamento usa a transição atômica e não grava status por fallback", async () => {
  const { service, pedidos, fila } = harness();
  const atualizado = await service.atualizar(1, {
    status: "cancelado",
    descricao: "cancelado pelo operador",
  });

  assert.equal(fila.cancelCalls, 1);
  assert.deepEqual(pedidos.updates, [{ descricao: "cancelado pelo operador" }]);
  assert.equal(atualizado.descricao, "cancelado pelo operador");
});

test("cancelamento recusa reserva ou impressão ativa", async () => {
  const { service, pedidos, fila } = harness();
  fila.cancelResult = "execucao_ativa";

  await assert.rejects(
    () => service.atualizar(1, { status: "cancelado" }),
    /reservado ou em impressão/i,
  );
  assert.equal(pedidos.updates.length, 0);
});

test("mutações físicas são recusadas quando o repository detecta execução ativa", async () => {
  for (const data of [{ idMaterial: 2 }, { idArquivo: 2 }, { idQualidade: 2 }]) {
    const { service, pedidos } = harness();
    pedidos.updateResult = "execution_active";
    await assert.rejects(
      () => service.atualizar(1, data),
      /reservado ou em impressão/i,
    );
  }
});

test("remoção recusa qualquer alocação ativa detectada sob lock", async () => {
  const { service, pedidos } = harness();
  pedidos.deleteResult = "execution_active";
  await assert.rejects(() => service.remover(1), /alocação ativa/i);
});
