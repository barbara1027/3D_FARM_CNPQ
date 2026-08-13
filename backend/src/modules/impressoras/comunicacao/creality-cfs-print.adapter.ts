import { Impressora } from "../impressoras.repository";
import {
  CFS_MAPPING_UNSUPPORTED,
  CfsInventory,
  CfsPrintAdapterError,
  CfsPrintStartResult,
  CfsPrintSubmission,
  CfsPrintSubmissionAdapter,
} from "./tipos";

const EVIDENCIAS_NECESSARIAS = [
  "capturas LAN sanitizadas de dois envios do mesmo G-code, alterando apenas o slot físico (1 e 2)",
  "endpoint, porta e mecanismo de autenticação, sem credenciais",
  "payload de send_print_cmd com open_cfs/color_match_info e a resposta de sucesso/erro",
  "inventário que relacione numeroSlot a boxId/deviceMaterialId",
  "validação separada nos firmwares da K2 Pro e da Creality Hi",
].join("; ");

/**
 * Fronteira segura para o protocolo LAN proprietário da Creality.
 *
 * O contrato fica disponível para o orquestrador, mas nenhuma chamada física é
 * feita até que o protocolo real seja comprovado. Em especial, este adapter não
 * usa Moonraker, não injeta T0-T3 e não chama /printer/gcode/script.
 */
export class CrealityCfsPrintAdapter implements CfsPrintSubmissionAdapter {
  readonly tipo = "CREALITY_CFS" as const;

  async consultarInventarioCfs(impressora: Impressora): Promise<CfsInventory> {
    throw this.protocoloNaoComprovado(impressora, "consultar o inventário físico do CFS");
  }

  async enviarEIniciarComMapeamento(
    impressora: Impressora,
    _entrada: CfsPrintSubmission,
  ): Promise<CfsPrintStartResult> {
    throw this.protocoloNaoComprovado(impressora, "enviar e iniciar a impressão com mapeamento CFS");
  }

  private protocoloNaoComprovado(impressora: Impressora, operacao: string): CfsPrintAdapterError {
    return new CfsPrintAdapterError(
      CFS_MAPPING_UNSUPPORTED,
      `Não é seguro ${operacao} na impressora ${impressora.id} (${impressora.modelo}) sem comprovar ` +
        `o protocolo LAN da Creality. Dados necessários: ${EVIDENCIAS_NECESSARIAS}.`,
    );
  }
}
