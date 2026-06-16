import { Request, Response } from "express";
import { FilaService } from "./fila.service";

function parseHorasOperador(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export class FilaController {
  constructor(private readonly filaService: FilaService) {}

  reescalonar = async (req: Request, res: Response) => {
    try {
      const horasOperadorDisponiveis = parseHorasOperador(
        req.body?.horasOperadorDisponiveis,
      );

      const alocacoes = await this.filaService.reescalonarFilaVirtual(
        horasOperadorDisponiveis,
      );

      return res.status(200).json({
        message: "Fila reescalonada com sucesso",
        totalAlocacoes: alocacoes.length,
        alocacoes,
      });
    } catch (error: any) {
      return res.status(500).json({
        message: error?.message ?? "Erro ao reescalonar fila.",
      });
    }
  };
}
