export type PrinterStatus =
  | 'Ociosa'
  | 'Reservada'
  | 'Imprimindo'
  | 'Pausada'
  | 'Indisponivel'
  | 'Aguardando Remoção'
  | 'Erro'
  | 'Manutenção';

export type ApiProtocol = 'OCTOPRINT' | 'MOONRAKER' | 'DUMMY';

export interface Impressora {
  id: number;
  nome: string;
  modelo: string;
  status: PrinterStatus;
  ip: string | null;
  baseUrl: string | null;
  api: ApiProtocol;
  api_key: string | null;
  timeoutMs: number;
  statusFisico: string | null;
  jobRemotoId: string | null;
  ultimoErro: string | null;
  ultimaSincronizacao: string | null;
  idMaterial: number | null;
  idPedidoAtual: number | null;
  eficiencia: number;
  taxaErroRecente: number;
  tempoParaFicarLivreHoras: number;
  capacidadeDiaHoras: number;
}

export interface ImpressoraEvento {
  id: number;
  idImpressora: number;
  tipo: string;
  mensagem: string;
  payloadJson: string | null;
  createdAt: string;
}
