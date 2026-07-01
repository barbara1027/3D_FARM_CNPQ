import path from "path";
import fs   from "fs/promises";
import { db } from "../../database/connection";
import { ArquivoRepository } from "../arquivos/arquivos.repository";
import { runPrusaSlicer, gcodeOutputPath } from "./slicer.service";
import { parseGcode, densityForMaterial } from "./gcode-parser";
import { scoreComplexity } from "./complexity-scorer";
import { calculatePrice, applyStripeFee } from "./price-calculator";
import { emailRevisaoPendente, emailPedidoFalhou } from "../../services/email.service";

/**
 * Roda o pipeline completo de análise em background.
 * Chamado com setImmediate após criar o pedido — não bloqueia a resposta HTTP.
 *
 * Pipeline:
 *   1. Busca pedido + arquivo STL + preço/grama do material
 *   2. Roda PrusaSlicer CLI  → gera G-code
 *   3. Analisa o G-code      → métricas
 *   4. Calcula score 0-1     → complexidade
 *   5. Calcula preço         → breakdown
 *   6. Atualiza o pedido     → status = aguardando_pagamento | aguardando_revisao
 */

// Lock para evitar execuções duplicadas do pipeline para o mesmo pedido
const runningPipelines = new Set<number>();

export async function runAutoSlicePipeline(pedidoId: number): Promise<void> {
  if (runningPipelines.has(pedidoId)) {
    console.warn(`[AUTO-SLICE] Pipeline para pedido ${pedidoId} já em execução. Ignorando duplicata.`);
    return;
  }

  runningPipelines.add(pedidoId);
  console.log(`[AUTO-SLICE] Iniciando pipeline para pedido ${pedidoId}...`);

  let row: any;

  try {
    const [rows]: any = await db.execute(`
      SELECT
        p.id,
        p.nome             AS pedidoNome,
        p.parametros,
        p.quantidade,
        u.nome             AS nomeUsuario,
        u.email            AS emailUsuario,
        a.caminho          AS stlPath,
        a.tipo             AS arquivoTipo,
        m.preco            AS pricePerGram,
        m.tipo             AS mTipo,
        m.diametro              AS mDiametro,
        m.fan_min               AS mFanMin,
        m.fan_max               AS mFanMax,
        m.temp_bico_min         AS mTempBicoMin,
        m.temp_bico_max         AS mTempBicoMax,
        m.temp_bico_recomendada AS mTempBicoRec,
        m.temp_mesa_min         AS mTempMesaMin,
        m.temp_mesa_max         AS mTempMesaMax,
        m.temp_mesa_recomendada AS mTempMesaRec,
        u.tipo             AS usuarioTipo,
        q.perimetros       AS qPerimetros,
        q.camadas_topo     AS qCamadasTopo,
        q.camadas_base     AS qCamadasBase,
        q.angulo_suporte   AS qAnguloSuporte,
        q.suporte          AS qSuport,
        q.adesao           AS qAdesao
      FROM pedidos p
      JOIN arquivos  a ON a.id = p.id_arquivo
      JOIN materiais m ON m.id = p.id_material
      JOIN usuarios  u ON u.id = p.id_usuario
      LEFT JOIN qualidades q ON q.id = p.id_qualidade
      WHERE p.id = ?
      LIMIT 1
    `, [pedidoId]);

    if (!rows?.length) throw new Error("Pedido não encontrado.");

    row = rows[0];

    if (row.arquivoTipo !== "stl") {
      throw new Error("Apenas arquivos .stl podem ser fatiados.");
    }

    // Resolve caminho absoluto do STL
    const stlAbsolute = path.isAbsolute(row.stlPath)
      ? row.stlPath
      : path.resolve(row.stlPath);

    await fs.access(stlAbsolute); // lança se não existir

    // Parâmetros escolhidos pelo usuário no frontend (prioridade máxima)
    const userParams: Record<string, string> = row.parametros
      ? (typeof row.parametros === "string" ? JSON.parse(row.parametros) : row.parametros)
      : {};

    // Temperatura padrão do material: usa recomendada se disponível, senão ponto médio do range
    const tempBicoDefault = row.mTempBicoRec
      ? String(Number(row.mTempBicoRec))
      : (row.mTempBicoMin && row.mTempBicoMax
          ? String(Math.round((Number(row.mTempBicoMin) + Number(row.mTempBicoMax)) / 2))
          : "");
    const tempMesaDefault = row.mTempMesaRec
      ? String(Number(row.mTempMesaRec))
      : (row.mTempMesaMin && row.mTempMesaMax
          ? String(Math.round((Number(row.mTempMesaMin) + Number(row.mTempMesaMax)) / 2))
          : "");

    // Merge: parâmetros do usuário > defaults da qualidade/material no banco
    // Para supports/adhesion: valor explícito do usuário tem prioridade;
    // se não foi modificado ("none"), usa o preset da qualidade como fallback.
    const sliceParams = {
      ...userParams,
      perimeters:       userParams.perimeters       ?? String(row.qPerimetros    ?? 2),
      topLayers:        userParams.topLayers        ?? String(row.qCamadasTopo   ?? 3),
      bottomLayers:     userParams.bottomLayers     ?? String(row.qCamadasBase   ?? 3),
      supportAngle:     userParams.supportAngle     ?? String(row.qAnguloSuporte ?? 45),
      supports: userParams.supports && userParams.supports !== "none"
        ? userParams.supports
        : "touching_buildplate",
      adhesion: userParams.adhesion && userParams.adhesion !== "none"
        ? userParams.adhesion
        : (Number(row.qAdesao) ? "brim" : "none"),
      fanMin:           userParams.fanMin           ?? (row.mFanMin != null ? String(row.mFanMin) : ""),
      fanMax:           userParams.fanMax           ?? (row.mFanMax != null ? String(row.mFanMax) : ""),
      filamentDiameter: userParams.filamentDiameter ?? (row.mDiametro ? String(row.mDiametro) : ""),
      tempBico:         userParams.tempBico         || tempBicoDefault,
      tempMesa:         userParams.tempMesa         || tempMesaDefault,
    };

    const gcodePath = gcodeOutputPath(pedidoId);
    await runPrusaSlicer(stlAbsolute, gcodePath, sliceParams);

    const gcodeStats = await fs.stat(gcodePath).catch(() => {
      throw new Error(`G-code não encontrado em ${gcodePath} após o slicing.`);
    });
    console.log(`[AUTO-SLICE] G-code gerado: ${gcodePath}`);

    // Registra o GCode na tabela arquivos (upsert)
    const arquivoRepo = new ArquivoRepository();
    await arquivoRepo.upsertGcode(pedidoId, gcodePath, gcodeStats.size / 1_000_000);

    const filamentDensity = densityForMaterial(row.mTipo ?? "PLA");
    const metrics = await parseGcode(gcodePath, filamentDensity);
    console.log(
      `[AUTO-SLICE] Métricas: ${metrics.timeSeconds}s, ` +
      `${metrics.materialGrams.toFixed(2)}g, ` +
      `suporte=${(metrics.supportRatio * 100).toFixed(1)}%, ` +
      `retrações=${metrics.retractionCount}, ilhas=${metrics.islandCount}`
    );

    const complexity = scoreComplexity(metrics);
    console.log(
      `[AUTO-SLICE] Score: ${complexity.score.toFixed(3)} ` +
      `(${complexity.isComplex ? "COMPLEXO" : "simples"})`
    );

    const quantidade   = Math.max(1, Number(row.quantidade) || 1);
    const pricePerGram = parseFloat(row.pricePerGram) || 0.12;
    const pricing      = calculatePrice(metrics, pricePerGram, complexity.score, complexity.isComplex);

    // Escala subtotal pela quantidade e aplica Stripe UMA VEZ sobre o total do pedido
    const totalSubtotal        = pricing.subtotal         * quantidade;
    const totalTaxaComplexidade = pricing.taxaComplexidade * quantidade;
    const { total: totalPreco, taxaStripe: totalTaxaStripe } = applyStripeFee(totalSubtotal);
    const totalTempoS          = metrics.timeSeconds       * quantidade;
    const totalGramas          = metrics.materialGrams     * quantidade;

    console.log(
      `[AUTO-SLICE] Preço: R$${totalPreco.toFixed(2)} ` +
      `(${quantidade}× R$${pricing.subtotal.toFixed(2)}, base R$${totalSubtotal.toFixed(2)} + Stripe R$${totalTaxaStripe.toFixed(2)})`
    );

    // Pedido criado por admin → vai direto para a fila (sem pagamento e sem revisão)
    // Peça não complexa (score < 0.5) → aguardando_pagamento
    // Peça complexa  (score >= 0.5) → aguardando_revisao (admin vê e pode ajustar preço)
    const novoStatus = row.usuarioTipo === "admin"
      ? "na_fila"
      : (complexity.isComplex ? "aguardando_revisao" : "aguardando_pagamento");

    await db.execute(`
      UPDATE pedidos SET
        status               = ?,
        preco                = ?,
        gcode_path           = ?,
        tempo_estimado_s     = ?,
        material_gramas      = ?,
        score_complexidade   = ?,
        motivo_complexidade  = ?,
        preco_base           = ?,
        taxa_complexidade    = ?,
        taxa_stripe          = ?,
        updated_at           = NOW()
      WHERE id = ?
    `, [
      novoStatus,
      totalPreco,
      gcodePath,
      totalTempoS,
      totalGramas,
      complexity.score,
      complexity.summary || null,
      totalSubtotal,
      totalTaxaComplexidade,
      totalTaxaStripe,
      pedidoId,
    ]);

    console.log(
      `[AUTO-SLICE] Pedido ${pedidoId} → ${novoStatus}, ` +
      `R$${totalPreco.toFixed(2)}`
    );

    if (complexity.isComplex && novoStatus === "aguardando_revisao") {
      await emailRevisaoPendente({
        id: pedidoId,
        nome: row.pedidoNome,
        nomeUsuario: row.nomeUsuario,
        emailUsuario: row.emailUsuario,
        preco: totalPreco,
        scoreComplexidade: complexity.score,
        motivoComplexidade: complexity.summary,
      });
    }

  } catch (err: any) {
    console.error(`[AUTO-SLICE] ERRO no pedido ${pedidoId}: ${err.message}`);

    // Limpa o G-code gerado, se existir
    try {
      const gcodePath = gcodeOutputPath(pedidoId);
      await fs.unlink(gcodePath);
    } catch { /* arquivo pode não existir ainda */ }

    // Marca o pedido como falhou para o cliente ver
    await db.execute(`
      UPDATE pedidos SET
        status     = 'falhou',
        updated_at = NOW()
      WHERE id = ?
    `, [pedidoId]).catch((e: any) => {
      console.error(`[AUTO-SLICE] Falha ao marcar pedido ${pedidoId} como 'falhou':`, e.message);
    });

    await emailPedidoFalhou({
      id: pedidoId,
      nome: row?.pedidoNome ?? `Pedido ${pedidoId}`,
      nomeUsuario: row?.nomeUsuario,
      emailUsuario: row?.emailUsuario,
      motivo: err.message,
    });

  } finally {
    runningPipelines.delete(pedidoId);
  }
}
