// MySQL retorna DECIMAL/FLOAT como string — este utilitário corrige isso

export function normalizePedido(p: any) {
  if (!p) return null;
  const n = (v: unknown) => (v != null ? Number(v) : null);
  return {
    ...p,
    preco:                    Number(p.preco ?? 0),
    idUsuario:                Number(p.idUsuario ?? 0),
    idMaterial:               Number(p.idMaterial ?? 0),
    materialGramas:           n(p.materialGramas),
    tempoEstimadoS:           n(p.tempoEstimadoS),
    scoreComplexidade:        n(p.scoreComplexidade),
    precoBase:                n(p.precoBase),
    taxaComplexidade:         n(p.taxaComplexidade),
    taxaStripe:               n(p.taxaStripe),
    tempoGcodeHoras:          n(p.tempoGcodeHoras),
    prazoEntregaHoras:        n(p.prazoEntregaHoras),
    etaHorasEstimado:         n(p.etaHorasEstimado),
    tempoMaximoEsperaHoras:   n(p.tempoMaximoEsperaHoras),
    bufferPrioridadeHoras:    n(p.bufferPrioridadeHoras),
    bufferSegurancaHoras:     n(p.bufferSegurancaHoras),
    tempoExecFarmHoras:       n(p.tempoExecFarmHoras),
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
