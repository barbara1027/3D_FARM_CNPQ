import assert from "node:assert/strict";
import { test } from "node:test";
import { PrinterMonitorWorker } from "./printerMonitor.worker";
import { ImpressoraRepository } from "./impressoras.repository";
import { ImpressoraService } from "./impressoras.service";

function fakeRepo(impressoras: any[]) {
  return { findAll: async () => impressoras } as unknown as ImpressoraRepository;
}

test("monitora apenas impressoras Moonraker em Imprimindo (conclusao/falha ficam a cargo do orquestrador)", async () => {
  const chamadas: number[] = [];
  const service = {
    monitorarStatusSilencioso: async (id: number) => {
      chamadas.push(id);
      return null;
    },
  } as unknown as ImpressoraService;

  const worker = new PrinterMonitorWorker(
    fakeRepo([
      { id: 1, api: "MOONRAKER", status: "Imprimindo" },
      { id: 2, api: "MOONRAKER", status: "Ociosa" },
      { id: 3, api: "DUMMY", status: "Imprimindo" },
      { id: 4, api: "MOONRAKER", status: "Imprimindo" },
      { id: 5, api: "MOONRAKER", status: "Erro" },
    ]),
    service,
  );

  await worker.executarCiclo();

  assert.deepEqual(chamadas.sort((a, b) => a - b), [1, 4]);
});

test("erro ao monitorar uma impressora nao impede o monitoramento das demais", async () => {
  const chamadas: number[] = [];
  const service = {
    monitorarStatusSilencioso: async (id: number) => {
      chamadas.push(id);
      if (id === 1) throw new Error("falha de rede");
      return null;
    },
  } as unknown as ImpressoraService;

  const worker = new PrinterMonitorWorker(
    fakeRepo([
      { id: 1, api: "MOONRAKER", status: "Imprimindo" },
      { id: 2, api: "MOONRAKER", status: "Imprimindo" },
    ]),
    service,
  );

  await worker.executarCiclo();

  assert.deepEqual(chamadas, [1, 2]);
});

test("nao inicia um segundo ciclo enquanto o anterior ainda esta rodando", async () => {
  let emAndamento = 0;
  let maximoConcorrente = 0;
  const service = {
    monitorarStatusSilencioso: async () => {
      emAndamento += 1;
      maximoConcorrente = Math.max(maximoConcorrente, emAndamento);
      await new Promise((resolve) => setTimeout(resolve, 10));
      emAndamento -= 1;
      return null;
    },
  } as unknown as ImpressoraService;

  const worker = new PrinterMonitorWorker(
    fakeRepo([{ id: 1, api: "MOONRAKER", status: "Imprimindo" }]),
    service,
  );

  await Promise.all([worker.executarCiclo(), worker.executarCiclo()]);

  assert.equal(maximoConcorrente, 1);
});
