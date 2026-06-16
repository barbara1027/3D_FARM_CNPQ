export interface QualidadeImpressao {
  id: number;
  nome: string;
  altura: number;
  espessura: number;
  preenchimento: number;
  velocidade: number;
  temperaturaBico: number;
  temperaturaMesa: number;
  suporte: number;
  adesao: number;
  perimetros: number;
  camadasTopo: number;
  camadasBase: number;
  anguloSuporte: number;
  createdAt?: string;
  updatedAt?: string;
}
