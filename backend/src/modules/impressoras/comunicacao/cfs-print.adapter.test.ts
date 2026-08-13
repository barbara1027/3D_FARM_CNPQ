import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Impressora } from "../impressoras.repository";
import { CrealityCfsPrintAdapter } from "./creality-cfs-print.adapter";
import { DummyCfsPrintAdapter } from "./dummy-cfs-print.adapter";
import { PrinterAdapterFactory } from "./printer-adapter.factory";
import {
  CfsInventory,
  CfsPrintAdapterError,
  CfsPrintErrorCode,
  CfsPrintSubmission,
} from "./tipos";

function impressora(
  api: Impressora["api"] = "DUMMY",
  possuiCfs = true,
): Impressora {
  return {
    id: 17,
    nome: "Impressora sanitizada",
    modelo: api === "DUMMY" ? "DUMMY" : "Modelo de teste",
    status: "Ociosa",
    ip: null,
    baseUrl: null,
    api,
    api_key: null,
    timeoutMs: 1_000,
    statusFisico: null,
    jobRemotoId: null,
    ultimoErro: null,
    ultimaSincronizacao: null,
    possuiCfs,
    larguraMesaMm: 220,
    profundidadeMesaMm: 220,
    filamentosCarregados: [],
    idPedidoAtual: null,
    eficiencia: 1,
    taxaErroRecente: 0,
    tempoParaFicarLivreHoras: 0,
    capacidadeDiaHoras: 8,
  };
}

const inventario: CfsInventory = {
  itens: [
    {
      numeroSlot: 2,
      boxId: "box-sanitizada-a",
      deviceMaterialId: "material-dispositivo-b",
      tipoMaterial: "PLA",
      cor: "#000000",
    },
    {
      numeroSlot: 4,
      boxId: "box-sanitizada-a",
      deviceMaterialId: "material-dispositivo-d",
      tipoMaterial: "PETG",
      cor: "#336699",
    },
  ],
  consultadoEm: "2026-01-01T00:00:00.000Z",
};

function submissao(overrides: Partial<CfsPrintSubmission> = {}): CfsPrintSubmission {
  return {
    caminhoGcode: "C:\\fixtures\\peca-segura.gcode",
    nomeArquivo: "peca-segura.gcode",
    openCfs: true,
    filamentos: [
      {
        extrusorLogico: 7,
        materialPlanejado: { idMaterialBanco: 101, numeroSlot: 2 },
        enderecoFisico: {
          numeroSlot: 2,
          boxId: "box-sanitizada-a",
          deviceMaterialId: "material-dispositivo-b",
        },
        tipoMaterial: "PLA",
        cor: "#000000",
      },
    ],
    ...overrides,
  };
}

async function esperarErro(
  acao: () => Promise<unknown> | unknown,
  codigo: CfsPrintErrorCode,
): Promise<CfsPrintAdapterError> {
  let erroCapturado: unknown;
  try {
    await acao();
  } catch (erro) {
    erroCapturado = erro;
  }
  if (!(erroCapturado instanceof CfsPrintAdapterError)) {
    throw new Error(`Era esperado o erro ${codigo}.`);
  }
  assert.equal(erroCapturado.code, codigo);
  return erroCapturado;
}

describe("adapters de submissão CFS", () => {
  it("permite configurar inventário sanitizado em runtime", async () => {
    const adapter = new DummyCfsPrintAdapter();
    const entradaComCampoExtra = {
      itens: inventario.itens.map((item) => ({ ...item })),
      consultadoEm: inventario.consultadoEm,
      segredoAcidental: "não deve ser retido",
    } as CfsInventory & { segredoAcidental: string };

    adapter.configurarInventarioCfs(17, entradaComCampoExtra);
    entradaComCampoExtra.itens[0].deviceMaterialId = "mutação-externa";
    const consultado = await adapter.consultarInventarioCfs(impressora());

    assert.equal(consultado.itens[0].deviceMaterialId, "material-dispositivo-b");
    assert.equal("segredoAcidental" in consultado, false);
    const resultado = await adapter.enviarEIniciarComMapeamento(impressora(), submissao());
    assert.notEqual(
      resultado.mapeamentoAplicado[0].materialPlanejado.idMaterialBanco,
      resultado.mapeamentoAplicado[0].enderecoFisico.deviceMaterialId,
    );
  });

  it("resolve o endereço físico pelo numeroSlot e registra o resultado simulado", async () => {
    const adapter = new DummyCfsPrintAdapter(new Map([[17, inventario]]));

    const resultado = await adapter.enviarEIniciarComMapeamento(impressora(), submissao());

    assert.equal(resultado.ok, true);
    assert.equal(resultado.aceito, true);
    assert.equal(resultado.confirmadoFisicamente, true);
    assert.deepEqual(resultado.mapeamentoAplicado[0].enderecoFisico, {
      numeroSlot: 2,
      boxId: "box-sanitizada-a",
      deviceMaterialId: "material-dispositivo-b",
    });
    assert.equal(adapter.listarSubmissoes().length, 1);
    assert.deepEqual(adapter.consultarResultado(resultado.jobRemotoId!), resultado);
  });

  it("mantém idMaterialBanco e deviceMaterialId em domínios distintos", async () => {
    const adapter = new DummyCfsPrintAdapter(new Map([[17, inventario]]));
    const resultado = await adapter.enviarEIniciarComMapeamento(impressora(), submissao());

    assert.equal(resultado.mapeamentoAplicado[0].materialPlanejado.idMaterialBanco, 101);
    assert.equal(
      resultado.mapeamentoAplicado[0].enderecoFisico.deviceMaterialId,
      "material-dispositivo-b",
    );

    const inventarioComIdReutilizado: CfsInventory = {
      itens: [{ numeroSlot: 2, boxId: "box-a", deviceMaterialId: 101 }],
    };
    const inseguro = new DummyCfsPrintAdapter(new Map([[17, inventarioComIdReutilizado]]));
    await esperarErro(
      () =>
        inseguro.enviarEIniciarComMapeamento(
          impressora(),
          submissao({
            filamentos: [
              {
                extrusorLogico: 7,
                materialPlanejado: { idMaterialBanco: 101, numeroSlot: 2 },
                enderecoFisico: { numeroSlot: 2, boxId: "box-a", deviceMaterialId: 101 },
              },
            ],
          }),
        ),
      "CFS_MAPPING_INVALID",
    );
  });

  it("preserva o extrusor lógico explicitamente fornecido no mapeamento monomaterial", async () => {
    const adapter = new DummyCfsPrintAdapter(new Map([[17, inventario]]));

    const resultado = await adapter.enviarEIniciarComMapeamento(impressora(), submissao());

    assert.equal(resultado.mapeamentoAplicado.length, 1);
    assert.equal(resultado.mapeamentoAplicado[0].extrusorLogico, 7);
    assert.notEqual(resultado.mapeamentoAplicado[0].extrusorLogico, 0);
  });

  it("falha quando o slot não pode ser resolvido e não registra submissão", async () => {
    const adapter = new DummyCfsPrintAdapter(new Map([[17, inventario]]));
    const entrada = submissao({
      filamentos: [
        {
          extrusorLogico: 3,
          materialPlanejado: { idMaterialBanco: 202, numeroSlot: 3 },
          enderecoFisico: {
            numeroSlot: 3,
            boxId: "box-sanitizada-a",
            deviceMaterialId: "material-inexistente",
          },
        },
      ],
    });

    await esperarErro(
      () => adapter.enviarEIniciarComMapeamento(impressora(), entrada),
      "CFS_SLOT_NOT_FOUND",
    );
    assert.equal(adapter.listarSubmissoes().length, 0);
  });

  it("rejeita openCfs falso em runtime e restringe o adapter a impressoras CFS", async () => {
    const adapter = new DummyCfsPrintAdapter(new Map([[17, inventario]]));
    const entradaInvalida = { ...submissao(), openCfs: false } as unknown as CfsPrintSubmission;

    await esperarErro(
      () => adapter.enviarEIniciarComMapeamento(impressora(), entradaInvalida),
      "CFS_MAPPING_INVALID",
    );
    await esperarErro(
      () => adapter.consultarInventarioCfs(impressora("DUMMY", false)),
      "CFS_NOT_CONFIGURED",
    );
  });

  it("factory não usa uploadAndStart comum como fallback para impressora CFS real", async () => {
    const dummy = new DummyCfsPrintAdapter(new Map([[17, inventario]]));
    const real = new CrealityCfsPrintAdapter();
    const factory = new PrinterAdapterFactory(dummy, real);
    const printer = impressora("MOONRAKER");
    const adapterComum = factory.getAdapter("MOONRAKER");
    let chamadasComuns = 0;
    const uploadOriginal = adapterComum.uploadAndStart.bind(adapterComum);
    adapterComum.uploadAndStart = async (...args) => {
      chamadasComuns += 1;
      return uploadOriginal(...args);
    };

    const adapterCfs = factory.getCfsAdapter(printer);
    assert.equal(adapterCfs.tipo, "CREALITY_CFS");
    await esperarErro(
      () => adapterCfs.consultarInventarioCfs(printer),
      "CFS_MAPPING_UNSUPPORTED",
    );
    const erro = await esperarErro(
      () => adapterCfs.enviarEIniciarComMapeamento(printer, submissao()),
      "CFS_MAPPING_UNSUPPORTED",
    );
    assert.match(erro.message, /capturas LAN sanitizadas/);
    assert.equal(chamadasComuns, 0);
  });
});
