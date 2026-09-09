import { ApiProtocol, Impressora } from "../impressoras.repository";
import { CrealityCfsPrintAdapter } from "./creality-cfs-print.adapter";
import { DummyCfsPrintAdapter } from "./dummy-cfs-print.adapter";
import { DummyPrinterAdapter } from "./dummy.adapter";
import { MoonrakerAdapter } from "./moonraker.adapter";
import { OctoprintAdapter } from "./octoprint.adapter";
import {
  CfsPrintAdapterError,
  CfsPrintSubmissionAdapter,
  IPrinterCommunicationAdapter,
} from "./tipos";

export class PrinterAdapterFactory {
  private readonly octoprintAdapter = new OctoprintAdapter();
  private readonly moonrakerAdapter = new MoonrakerAdapter();
  private readonly dummyAdapter = new DummyPrinterAdapter();

  constructor(
    private readonly dummyCfsAdapter: CfsPrintSubmissionAdapter = new DummyCfsPrintAdapter(),
    private readonly crealityCfsAdapter: CfsPrintSubmissionAdapter =
      new CrealityCfsPrintAdapter(),
  ) {}

  getAdapter(protocol: ApiProtocol): IPrinterCommunicationAdapter {
    switch (protocol) {
      case "OCTOPRINT":
        return this.octoprintAdapter;
      case "MOONRAKER":
        return this.moonrakerAdapter;
      case "DUMMY":
        return this.dummyAdapter;
      default:
        throw new Error(`Protocolo de comunicação '${protocol}' não suportado.`);
    }
  }

  getCfsAdapter(impressora: Impressora): CfsPrintSubmissionAdapter {
    if (!impressora.possuiCfs) {
      throw new CfsPrintAdapterError(
        "CFS_NOT_CONFIGURED",
        `A impressora ${impressora.id} não está configurada com CFS.`,
      );
    }
    return impressora.api === "DUMMY" ? this.dummyCfsAdapter : this.crealityCfsAdapter;
  }
}
