export type StatusPedido =
  | 'analisando'            // slicer rodando — preço ainda não calculado
  | 'aguardando_pagamento'  // orçamento pronto, cliente precisa pagar
  | 'aguardando_revisao'    // peça complexa, admin aprova antes de cobrar
  | 'na_fila'               // pago + aprovado, aguarda impressora
  | 'em_impressao'
  | 'concluido'
  | 'falhou'
  | 'cancelado';

export interface Pedido {
  id: number;
  nome: string;
  quantidade: number;
  preco: number;
  descricao: string | null;
  status: StatusPedido;
  idUsuario: number;
  idMaterial: number;
  idQualidade: number;
  idArquivo: number;
  // Análise do slicer
  tempoEstimadoS: number | null;
  materialGramas: number | null;
  scoreComplexidade: number | null;
  motivoComplexidade: string | null;
  precoBase: number | null;
  taxaComplexidade: number | null;
  taxaStripe: number | null;
  gcodePath: string | null;
  // Fila e ETA
  tempoGcodeHoras: number | null;
  prazoEntregaHoras: number | null;
  prazoEntrega: string | null;
  etaHorasEstimado: number | null;
  etaCalculadoEm: string | null;
  prazoEntregaOriginal: string | null;
  limiteInicioImpressao: string | null;
  prioridadePaga: boolean;
  tempoMaximoEsperaHoras: number | null;
  bufferPrioridadeHoras: number | null;
  bufferSegurancaHoras: number | null;
  tempoExecFarmHoras: number | null;
  // Joins
  nomeUsuario?: string;
  emailUsuario?: string;
  nomeMaterial?: string;
  nomeArquivo?: string;
  caminhoArquivo?: string;
  idArquivoGcode?: number | null;
  createdAt: string;
  updatedAt: string;
}
