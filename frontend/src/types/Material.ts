export type MaterialStatus = 'disponivel' | 'indisponivel';

export interface Material {
  id: number;
  nome: string;
  tipo: string;
  preco: number;
  status: MaterialStatus;
  cor: string;
  diametro: number;
  tempBicoMin: number | null;
  tempBicoMax: number | null;
  tempMesaMin: number | null;
  tempMesaMax: number | null;
  fanMin: number | null;
  fanMax: number | null;
  camadaMin: number | null;
  camadaMax: number | null;
}
