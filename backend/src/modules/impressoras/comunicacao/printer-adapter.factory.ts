import { ApiProtocol } from "../impressoras.repository";
import { DummyPrinterAdapter } from "./dummy.adapter";
import { MoonrakerAdapter } from "./moonraker.adapter";
import { OctoprintAdapter } from "./octoprint.adapter";
import { IPrinterCommunicationAdapter } from "./tipos";

export class PrinterAdapterFactory {
  private readonly octoprintAdapter = new OctoprintAdapter();
  private readonly moonrakerAdapter = new MoonrakerAdapter();
  private readonly dummyAdapter = new DummyPrinterAdapter();

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
}
