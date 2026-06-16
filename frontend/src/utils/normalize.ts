// MySQL retorna DECIMAL/FLOAT como string — este utilitário corrige isso

export function normalizePedido(p: any) {
  if (!p) return null;
  return {
    ...p,
    preco:              Number(p.preco ?? 0),
    materialGramas:     p.materialGramas !== null ? Number(p.materialGramas) : null,
    tempoEstimadoS:     p.tempoEstimadoS !== null ? Number(p.tempoEstimadoS) : null,
    scoreComplexidade:  p.scoreComplexidade !== null ? Number(p.scoreComplexidade) : null,
    precoBase:          p.precoBase !== null ? Number(p.precoBase) : null,
    taxaComplexidade:   p.taxaComplexidade !== null ? Number(p.taxaComplexidade) : null,
    taxaStripe:         p.taxaStripe !== null ? Number(p.taxaStripe) : null,
    idUsuario:          Number(p.idUsuario ?? 0),
    idMaterial:         Number(p.idMaterial ?? 0)
  };
}

export function normalizeMaterial(m: any) {
  return {
    ...m,
    preco:       Number(m.preco       ?? 0),
    diametro:    Number(m.diametro    ?? 1.75),
    tempBicoMin: m.tempBicoMin != null ? Number(m.tempBicoMin) : null,
    tempBicoMax: m.tempBicoMax != null ? Number(m.tempBicoMax) : null,
    tempMesaMin: m.tempMesaMin != null ? Number(m.tempMesaMin) : null,
    tempMesaMax: m.tempMesaMax != null ? Number(m.tempMesaMax) : null,
    fanMin:      m.fanMin      != null ? Number(m.fanMin)      : null,
    fanMax:      m.fanMax      != null ? Number(m.fanMax)      : null,
    camadaMin:   m.camadaMin   != null ? Number(m.camadaMin)   : null,
    camadaMax:   m.camadaMax   != null ? Number(m.camadaMax)   : null,
  };
}

export function normalizeQualidade(q: any) {
  return {
    ...q,
    altura:          Number(q.altura          ?? 0),
    espessura:       Number(q.espessura       ?? 0),
    preenchimento:   Number(q.preenchimento   ?? 0),
    velocidade:      Number(q.velocidade      ?? 0),
    temperaturaBico: Number(q.temperaturaBico ?? 0),
    temperaturaMesa: Number(q.temperaturaMesa ?? 0),
    suporte:         Number(q.suporte         ?? 0),
    adesao:          Number(q.adesao          ?? 0),
    perimetros:      Number(q.perimetros      ?? 2),
    camadasTopo:     Number(q.camadasTopo     ?? 3),
    camadasBase:     Number(q.camadasBase     ?? 3),
    anguloSuporte:   Number(q.anguloSuporte   ?? 45),
  };
}
