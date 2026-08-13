import { Impressora } from "../impressoras.repository";
import {
  CfsFilamentMapping,
  CfsInventory,
  CfsInventoryItem,
  CfsPrintAdapterError,
  CfsPrintStartResult,
  CfsPrintSubmission,
  CfsPrintSubmissionAdapter,
} from "./tipos";

export type DummyCfsInventories =
  | ReadonlyMap<number, CfsInventory>
  | Readonly<Record<number, CfsInventory>>;

export interface DummyCfsRecordedSubmission {
  idImpressora: number;
  entrada: CfsPrintSubmission;
  resultado: CfsPrintStartResult;
}

/** Adapter CFS determinístico e sem I/O, destinado a testes isolados. */
export class DummyCfsPrintAdapter implements CfsPrintSubmissionAdapter {
  readonly tipo = "DUMMY_CFS" as const;

  private readonly inventarios = new Map<number, CfsInventory>();
  private readonly submissoes = new Map<string, DummyCfsRecordedSubmission>();
  private sequencia = 0;

  constructor(inventariosIniciais: DummyCfsInventories = new Map()) {
    const entradas =
      inventariosIniciais instanceof Map
        ? inventariosIniciais.entries()
        : Object.entries(inventariosIniciais).map(
            ([idImpressora, inventario]) => [Number(idImpressora), inventario] as const,
          );

    for (const [idImpressora, inventario] of entradas) {
      this.configurarInventarioCfs(idImpressora, inventario);
    }
  }

  /**
   * Injeta ou substitui o inventário simulado de uma impressora em runtime.
   * Somente os campos públicos do contrato são retidos e o valor é clonado.
   */
  configurarInventarioCfs(idImpressora: number, inventario: CfsInventory): void {
    if (!Number.isInteger(idImpressora) || idImpressora <= 0) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `Inventário DUMMY associado a id de impressora inválido: ${String(idImpressora)}.`,
      );
    }
    this.inventarios.set(idImpressora, this.sanitizarInventario(inventario));
  }

  async consultarInventarioCfs(impressora: Impressora): Promise<CfsInventory> {
    this.validarFluxoCfs(impressora);
    const inventario = this.inventarios.get(impressora.id);
    if (!inventario) {
      throw new CfsPrintAdapterError(
        "CFS_INVENTORY_UNAVAILABLE",
        `Nenhum inventário CFS sanitizado foi injetado para a impressora DUMMY ${impressora.id}.`,
      );
    }
    return this.clonarInventario(inventario);
  }

  async enviarEIniciarComMapeamento(
    impressora: Impressora,
    entrada: CfsPrintSubmission,
  ): Promise<CfsPrintStartResult> {
    this.validarFluxoCfs(impressora);
    if (entrada.openCfs !== true) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O fluxo CFS exige openCfs=true explicitamente.",
      );
    }
    if (!entrada.caminhoGcode.trim() || !entrada.nomeArquivo.trim()) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "caminhoGcode e nomeArquivo são obrigatórios na submissão CFS.",
      );
    }
    if (entrada.filamentos.length === 0) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "A submissão CFS deve fornecer ao menos um mapeamento de filamento.",
      );
    }

    const inventario = await this.consultarInventarioCfs(impressora);
    const extrusores = new Set<number>();
    const mapeamentoAplicado = entrada.filamentos.map((filamento) => {
      this.validarMapeamentoBasico(filamento);
      if (extrusores.has(filamento.extrusorLogico)) {
        throw new CfsPrintAdapterError(
          "CFS_MAPPING_INVALID",
          `O extrusor lógico ${filamento.extrusorLogico} foi informado mais de uma vez.`,
        );
      }
      extrusores.add(filamento.extrusorLogico);
      return this.resolverEValidarEndereco(inventario, filamento);
    });

    const jobRemotoId = `dummy-cfs-${impressora.id}-${++this.sequencia}`;
    const resultado: CfsPrintStartResult = {
      ok: true,
      aceito: true,
      confirmadoFisicamente: true,
      mensagem: `Modo DUMMY CFS: ${entrada.nomeArquivo} iniciado com mapeamento explícito.`,
      jobRemotoId,
      nomeArquivoRemoto: entrada.nomeArquivo,
      mapeamentoAplicado,
      rawStatus: { simulado: true, openCfs: true },
    };

    this.submissoes.set(jobRemotoId, {
      idImpressora: impressora.id,
      entrada: this.clonarEntrada(entrada),
      resultado: this.clonarResultado(resultado),
    });
    return this.clonarResultado(resultado);
  }

  /** Consulta somente o estado simulado já registrado, sem efeitos externos. */
  consultarResultado(jobRemotoId: string): CfsPrintStartResult | null {
    const submissao = this.submissoes.get(jobRemotoId);
    return submissao ? this.clonarResultado(submissao.resultado) : null;
  }

  listarSubmissoes(): DummyCfsRecordedSubmission[] {
    return [...this.submissoes.values()].map((submissao) => ({
      idImpressora: submissao.idImpressora,
      entrada: this.clonarEntrada(submissao.entrada),
      resultado: this.clonarResultado(submissao.resultado),
    }));
  }

  private validarFluxoCfs(impressora: Impressora): void {
    if (!impressora.possuiCfs) {
      throw new CfsPrintAdapterError(
        "CFS_NOT_CONFIGURED",
        `A impressora ${impressora.id} não está configurada com CFS.`,
      );
    }
  }

  private validarMapeamentoBasico(filamento: CfsFilamentMapping): void {
    if (!Number.isInteger(filamento.extrusorLogico) || filamento.extrusorLogico < 0) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "extrusorLogico deve ser fornecido explicitamente como inteiro não negativo.",
      );
    }
    if (
      !Number.isInteger(filamento.materialPlanejado.idMaterialBanco) ||
      filamento.materialPlanejado.idMaterialBanco <= 0
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "idMaterialBanco deve ser um inteiro positivo do domínio interno da aplicação.",
      );
    }
    this.validarNumeroSlot(filamento.materialPlanejado.numeroSlot);
    if (filamento.enderecoFisico.numeroSlot !== filamento.materialPlanejado.numeroSlot) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "O numeroSlot planejado diverge do numeroSlot do endereço físico informado.",
      );
    }
  }

  private resolverEValidarEndereco(
    inventario: CfsInventory,
    filamento: CfsFilamentMapping,
  ): CfsFilamentMapping {
    const numeroSlot = filamento.materialPlanejado.numeroSlot;
    const enderecoResolvido = inventario.itens.find((item) => item.numeroSlot === numeroSlot);
    if (!enderecoResolvido) {
      throw new CfsPrintAdapterError(
        "CFS_SLOT_NOT_FOUND",
        `O slot físico ${numeroSlot} não existe no inventário CFS atual.`,
      );
    }

    if (
      String(filamento.enderecoFisico.boxId) !== String(enderecoResolvido.boxId) ||
      String(filamento.enderecoFisico.deviceMaterialId) !==
        String(enderecoResolvido.deviceMaterialId)
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `O endereço físico fornecido para o slot ${numeroSlot} diverge do inventário atual.`,
      );
    }

    if (
      String(filamento.materialPlanejado.idMaterialBanco) ===
      String(enderecoResolvido.deviceMaterialId)
    ) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "idMaterialBanco não pode ser reutilizado como deviceMaterialId; os identificadores pertencem a domínios distintos.",
      );
    }

    return {
      extrusorLogico: filamento.extrusorLogico,
      materialPlanejado: { ...filamento.materialPlanejado },
      enderecoFisico: {
        boxId: enderecoResolvido.boxId,
        deviceMaterialId: enderecoResolvido.deviceMaterialId,
        numeroSlot: enderecoResolvido.numeroSlot,
      },
      ...(filamento.tipoMaterial !== undefined
        ? { tipoMaterial: filamento.tipoMaterial }
        : enderecoResolvido.tipoMaterial !== undefined
          ? { tipoMaterial: enderecoResolvido.tipoMaterial }
          : {}),
      ...(filamento.cor !== undefined
        ? { cor: filamento.cor }
        : enderecoResolvido.cor !== undefined
          ? { cor: enderecoResolvido.cor }
          : {}),
    };
  }

  private sanitizarInventario(inventario: CfsInventory): CfsInventory {
    if (!inventario || !Array.isArray(inventario.itens)) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        "Inventário DUMMY inválido: itens deve ser uma lista.",
      );
    }
    const slots = new Set<number>();
    const itens = inventario.itens.map((item) => {
      this.validarNumeroSlot(item.numeroSlot);
      if (slots.has(item.numeroSlot)) {
        throw new CfsPrintAdapterError(
          "CFS_MAPPING_INVALID",
          `Inventário DUMMY contém o slot ${item.numeroSlot} mais de uma vez.`,
        );
      }
      slots.add(item.numeroSlot);
      this.validarIdentificadorFisico(item.boxId, "boxId", item.numeroSlot);
      this.validarIdentificadorFisico(
        item.deviceMaterialId,
        "deviceMaterialId",
        item.numeroSlot,
      );
      return this.sanitizarItem(item);
    });
    return {
      itens,
      ...(inventario.consultadoEm !== undefined
        ? { consultadoEm: String(inventario.consultadoEm) }
        : {}),
    };
  }

  private validarNumeroSlot(numeroSlot: number): void {
    if (!Number.isInteger(numeroSlot) || numeroSlot < 1 || numeroSlot > 4) {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `numeroSlot deve ser um inteiro entre 1 e 4; recebido ${String(numeroSlot)}.`,
      );
    }
  }

  private validarIdentificadorFisico(
    valor: number | string,
    nome: "boxId" | "deviceMaterialId",
    numeroSlot: number,
  ): void {
    if ((typeof valor !== "number" && typeof valor !== "string") || String(valor).trim() === "") {
      throw new CfsPrintAdapterError(
        "CFS_MAPPING_INVALID",
        `${nome} inválido no inventário DUMMY do slot ${numeroSlot}.`,
      );
    }
  }

  private sanitizarItem(item: CfsInventoryItem): CfsInventoryItem {
    return {
      numeroSlot: item.numeroSlot,
      boxId: item.boxId,
      deviceMaterialId: item.deviceMaterialId,
      ...(item.tipoMaterial !== undefined ? { tipoMaterial: String(item.tipoMaterial) } : {}),
      ...(item.cor !== undefined ? { cor: String(item.cor) } : {}),
    };
  }

  private clonarInventario(inventario: CfsInventory): CfsInventory {
    return {
      itens: inventario.itens.map((item) => ({ ...item })),
      ...(inventario.consultadoEm !== undefined
        ? { consultadoEm: inventario.consultadoEm }
        : {}),
    };
  }

  private clonarEntrada(entrada: CfsPrintSubmission): CfsPrintSubmission {
    return {
      caminhoGcode: entrada.caminhoGcode,
      nomeArquivo: entrada.nomeArquivo,
      openCfs: true,
      filamentos: entrada.filamentos.map((filamento) => ({
        ...filamento,
        materialPlanejado: { ...filamento.materialPlanejado },
        enderecoFisico: { ...filamento.enderecoFisico },
      })),
    };
  }

  private clonarResultado(resultado: CfsPrintStartResult): CfsPrintStartResult {
    return {
      ...resultado,
      mapeamentoAplicado: resultado.mapeamentoAplicado.map((filamento) => ({
        ...filamento,
        materialPlanejado: { ...filamento.materialPlanejado },
        enderecoFisico: { ...filamento.enderecoFisico },
      })),
      rawStatus:
        resultado.rawStatus && typeof resultado.rawStatus === "object"
          ? { ...resultado.rawStatus }
          : resultado.rawStatus,
    };
  }
}
