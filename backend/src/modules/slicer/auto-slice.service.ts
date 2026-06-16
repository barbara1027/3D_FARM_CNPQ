import path from "path";
import fs   from "fs/promises";
import { db } from "../../database/connection";
import { ArquivoRepository } from "../arquivos/arquivos.repository";
import { runPrusaSlicer, gcodeOutputPath } from "./slicer.service";
import { parseGcode } from "./gcode-parser";
import { scoreComplexity } from "./complexity-scorer";
import { calculatePrice } from "./price-calculator";
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
    // ── 1. Dados do pedido ─────────────────────────────────────────────────
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
        m.diametro         AS mDiametro,
        m.fan_min          AS mFanMin,
        m.fan_max          AS mFanMax,
        m.temp_bico_min    AS mTempBicoMin,
        m.temp_bico_max    AS mTempBicoMax,
        m.temp_mesa_min    AS mTempMesaMin,
        m.temp_mesa_max    AS mTempMesaMax,
        q.perimetros       AS qPerimetros,
        q.camadas_topo     AS qCamadasTopo,
        q.camadas_base     AS qCamadasBase,
        q.angulo_suporte   AS qAnguloSuporte
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

    // Temperatura padrão do material = ponto médio do range
    const tempBicoDefault = row.mTempBicoMin && row.mTempBicoMax
      ? String(Math.round((Number(row.mTempBicoMin) + Number(row.mTempBicoMax)) / 2))
      : "";
    const tempMesaDefault = row.mTempMesaMin && row.mTempMesaMax
      ? String(Math.round((Number(row.mTempMesaMin) + Number(row.mTempMesaMax)) / 2))
      : "";

    // Merge: parâmetros do usuário > defaults da qualidade/material no banco
    const sliceParams = {
      ...userParams,
      perimeters:       userParams.perimeters       ?? String(row.qPerimetros    ?? 2),
      topLayers:        userParams.topLayers        ?? String(row.qCamadasTopo   ?? 3),
      bottomLayers:     userParams.bottomLayers     ?? String(row.qCamadasBase   ?? 3),
      supportAngle:     userParams.supportAngle     ?? String(row.qAnguloSuporte ?? 45),
      fanMin:           userParams.fanMin           ?? (row.mFanMin != null ? String(row.mFanMin) : ""),
      fanMax:           userParams.fanMax           ?? (row.mFanMax != null ? String(row.mFanMax) : ""),
      filamentDiameter: userParams.filamentDiameter ?? (row.mDiametro ? String(row.mDiametro) : ""),
      tempBico:         userParams.tempBico         || tempBicoDefault,
      tempMesa:         userParams.tempMesa         || tempMesaDefault,
    };

    // ── 2. Fatiamento ──────────────────────────────────────────────────────
    const gcodePath = gcodeOutputPath(pedidoId);
    await runPrusaSlicer(stlAbsolute, gcodePath, sliceParams);
    console.log(`[AUTO-SLICE] G-code gerado: ${gcodePath}`);

    // Registra o GCode na tabela arquivos (upsert)
    const gcodeStats = await fs.stat(gcodePath).catch(() => ({ size: 0 }));
    const arquivoRepo = new ArquivoRepository();
    await arquivoRepo.upsertGcode(pedidoId, gcodePath, gcodeStats.size / 1_000_000);

    // ── 3. Análise do G-code ──────────────────────────────────────────────
    const metrics = await parseGcode(gcodePath);
    console.log(
      `[AUTO-SLICE] Métricas: ${metrics.timeSeconds}s, ` +
      `${metrics.materialGrams.toFixed(2)}g, ` +
      `suporte=${(metrics.supportRatio * 100).toFixed(1)}%, ` +
      `retrações=${metrics.retractionCount}, ilhas=${metrics.islandCount}`
    );

    // ── 4. Score de complexidade ───────────────────────────────────────────
    const complexity = scoreComplexity(metrics);
    console.log(
      `[AUTO-SLICE] Score: ${complexity.score.toFixed(3)} ` +
      `(${complexity.isComplex ? "COMPLEXO" : "simples"})`
    );

    // ── 5. Preço ───────────────────────────────────────────────────────────
    const quantidade   = Math.max(1, Number(row.quantidade) || 1);
    const pricePerGram = parseFloat(row.pricePerGram) || 0.12;
    const pricing      = calculatePrice(metrics, pricePerGram, complexity.score);

    // Multiplica pelo número de cópias
    const totalPreco           = pricing.total          * quantidade;
    const totalSubtotal        = pricing.subtotal       * quantidade;
    const totalTaxaComplexidade = pricing.taxaComplexidade * quantidade;
    const totalTaxaStripe      = pricing.taxaStripe     * quantidade;
    const totalTempoS          = metrics.timeSeconds    * quantidade;
    const totalGramas          = metrics.materialGrams  * quantidade;

    console.log(
      `[AUTO-SLICE] Preço: R$${totalPreco.toFixed(2)} ` +
      `(${quantidade}× R$${pricing.total.toFixed(2)}, base R$${totalSubtotal.toFixed(2)} + Stripe R$${totalTaxaStripe.toFixed(2)})`
    );

    // ── 6. Persiste resultado ──────────────────────────────────────────────
    // Peça não complexa (score < 0.5) → aguardando_pagamento
    // Peça complexa  (score >= 0.5) → aguardando_revisao (admin vê e pode ajustar preço)
    const novoStatus = complexity.isComplex
      ? "aguardando_revisao"
      : "aguardando_pagamento";

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

    if (complexity.isComplex) {
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
