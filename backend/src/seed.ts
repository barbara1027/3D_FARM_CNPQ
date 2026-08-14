import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcrypt";
import { ResultSetHeader } from "mysql2";
import { db } from "./database/connection";
import { getDatabaseConfig } from "./database/config";
import { verifyDatabase } from "./database/commands/verify";
import { EXPECTED_TABLES } from "./database/schema-expectations";

function seedLockName(database: string): string {
  const digest = createHash("sha256").update(database).digest("hex").slice(0, 32);
  return `3d_farm_db_seed_${digest}`;
}

function validateSeedEnvironment(): { database: string; password: string } {
  const { database } = getDatabaseConfig();
  if (process.env.NODE_ENV !== "development") {
    throw new Error("O db:seed é exclusivo de desenvolvimento. Defina NODE_ENV=development.");
  }
  if (process.env.DB_SEED_CONFIRM !== database) {
    throw new Error("Para confirmar o banco de desenvolvimento, defina DB_SEED_CONFIRM com o mesmo valor de DB_NAME.");
  }

  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("DEV_SEED_PASSWORD deve ter pelo menos 12 caracteres e é usada somente pelos usuários genéricos do seed.");
  }
  return { database, password };
}

export async function seedDevelopmentData(): Promise<void> {
  const { database, password } = validateSeedEnvironment();
  await verifyDatabase({ quiet: true });

  const connection = await db.getConnection();
  const lock = seedLockName(database);
  let locked = false;
  let transactionStarted = false;

  try {
    const [lockRows]: any = await connection.execute("SELECT GET_LOCK(?, 0) AS acquired", [lock]);
    if (Number(lockRows[0]?.acquired) !== 1) throw new Error("Outro seed deste banco já está em andamento.");
    locked = true;

    for (const table of EXPECTED_TABLES) {
      const [rows]: any = await connection.query(`SELECT COUNT(*) AS total FROM \`${table}\``);
      if (Number(rows[0]?.total) !== 0) {
        throw new Error(`Seed recusado: a tabela ${table} já contém dados. Nenhuma linha foi apagada.`);
      }
    }

    await connection.beginTransaction();
    transactionStarted = true;
    const passwordHash = await bcrypt.hash(password, 12);

    const insert = async (sql: string, values: unknown[]): Promise<number> => {
      const [result] = await connection.execute<ResultSetHeader>(sql, values);
      return result.insertId;
    };

    const adminId = await insert(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, nivel)
       VALUES (?, ?, ?, 'admin', 'avancado')`,
      ["Administrador de desenvolvimento", "admin.dev@3dfarm.invalid", passwordHash],
    );
    const clienteId = await insert(
      `INSERT INTO usuarios (nome, email, senha_hash, tipo, nivel)
       VALUES (?, ?, ?, 'cliente', 'iniciante')`,
      ["Cliente de desenvolvimento", "cliente.dev@3dfarm.invalid", passwordHash],
    );

    const plaId = await insert(
      `INSERT INTO materiais (
         nome, tipo, cor, preco, status,
         temp_bico_min, temp_bico_max, temp_bico_recomendada,
         temp_mesa_min, temp_mesa_max, temp_mesa_recomendada,
         diametro, fan_min, fan_max, camada_min, camada_max
       ) VALUES (?, ?, ?, ?, 'disponivel', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Material PLA de desenvolvimento", "PLA", "Neutra", 0.1200, 195, 220, 205, 50, 60, 55, 1.75, 50, 100, 0.08, 0.30],
    );
    const petgId = await insert(
      `INSERT INTO materiais (
         nome, tipo, cor, preco, status,
         temp_bico_min, temp_bico_max, temp_bico_recomendada,
         temp_mesa_min, temp_mesa_max, temp_mesa_recomendada,
         diametro, fan_min, fan_max, camada_min, camada_max
       ) VALUES (?, ?, ?, ?, 'disponivel', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Material PETG de desenvolvimento", "PETG", "Neutra", 0.1800, 225, 245, 235, 70, 90, 80, 1.75, 30, 50, 0.10, 0.30],
    );
    const absId = await insert(
      `INSERT INTO materiais (
         nome, tipo, cor, preco, status,
         temp_bico_min, temp_bico_max, temp_bico_recomendada,
         temp_mesa_min, temp_mesa_max, temp_mesa_recomendada,
         diametro, fan_min, fan_max, camada_min, camada_max
       ) VALUES (?, ?, ?, ?, 'disponivel', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Material ABS de desenvolvimento", "ABS", "Neutra", 0.1500, 220, 255, 240, 100, 115, 105, 1.75, 0, 25, 0.10, 0.30],
    );

    const qualidadeNormalId = await insert(
      `INSERT INTO qualidades (nome, altura, espessura, velocidade, suporte, adesao, perimetros, camadas_topo, camadas_base, angulo_suporte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Normal", 0.200, 1.200, 60, 0, 0, 2, 3, 3, 45],
    );
    const qualidadeDetalheId = await insert(
      `INSERT INTO qualidades (nome, altura, espessura, velocidade, suporte, adesao, perimetros, camadas_topo, camadas_base, angulo_suporte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Detalhada", 0.150, 1.600, 50, 0, 0, 3, 4, 4, 50],
    );
    const qualidadeSuporteId = await insert(
      `INSERT INTO qualidades (nome, altura, espessura, velocidade, suporte, adesao, perimetros, camadas_topo, camadas_base, angulo_suporte)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ["Com suporte", 0.120, 2.000, 40, 1, 1, 3, 5, 5, 50],
    );

    const stlFilaId = await insert(
      "INSERT INTO arquivos (nome, tipo, caminho, tamanho_mb) VALUES (?, 'stl', ?, ?)",
      ["peca_fila_demo.stl", "uploads/dev/peca_fila_demo.stl", 1.250],
    );
    const stlConcluidoId = await insert(
      "INSERT INTO arquivos (nome, tipo, caminho, tamanho_mb) VALUES (?, 'stl', ?, ?)",
      ["peca_concluida_demo.stl", "uploads/dev/peca_concluida_demo.stl", 2.500],
    );
    const stlAnaliseId = await insert(
      "INSERT INTO arquivos (nome, tipo, caminho, tamanho_mb) VALUES (?, 'stl', ?, ?)",
      ["peca_analise_demo.stl", "uploads/dev/peca_analise_demo.stl", 0.750],
    );

    // Um pedido em 'na_fila' nunca pode existir sem base temporal completa
    // (ver EtaEntregaService / pedidoEstaProntoParaFila) — os dados abaixo
    // simulam um ETA já calculado, coerentes com tempo_gcode_horas=2.00 e
    // prazo_entrega_horas=48.00.
    const pedidoFilaId = await insert(
      `INSERT INTO pedidos (
         nome, preco, descricao, status, id_usuario, id_material, id_qualidade, id_arquivo,
         parametros, quantidade, gcode_path, tempo_estimado_s, material_gramas,
         score_complexidade, preco_base, taxa_complexidade, taxa_stripe,
         tempo_gcode_horas, prazo_entrega_horas, prioridade_paga,
         tempo_exec_farm_horas, eta_horas_estimado, eta_calculado_em,
         prazo_entrega, prazo_entrega_original, limite_inicio_impressao,
         tempo_maximo_espera_horas, buffer_prioridade_horas, buffer_seguranca_horas
       ) VALUES (
         ?, ?, ?, 'na_fila', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
         ?, ?, NOW(),
         DATE_ADD(NOW(), INTERVAL 48 HOUR), DATE_ADD(NOW(), INTERVAL 48 HOUR), DATE_ADD(NOW(), INTERVAL 45 HOUR),
         ?, ?, ?
       )`,
      [
        "Pedido de fila demonstrativo", 24.90, "Dados genéricos de desenvolvimento.", clienteId,
        plaId, qualidadeNormalId, stlFilaId, JSON.stringify({ preenchimento: 20 }), 1,
        "gcode_storage/dev/pedido_fila_demo.gcode", 7200, 42.5000, 0.1500, 22.00, 0.00, 2.90,
        2.00, 48.00, 0,
        2.30, 48.00,
        45.70, 4.80, 8.00,
      ],
    );
    const pedidoConcluidoId = await insert(
      `INSERT INTO pedidos (
         nome, preco, descricao, status, id_usuario, id_material, id_qualidade, id_arquivo,
         parametros, quantidade, gcode_path, tempo_estimado_s, material_gramas,
         score_complexidade, preco_base, taxa_complexidade, taxa_stripe,
         tempo_gcode_horas, prazo_entrega_horas, prioridade_paga
       ) VALUES (?, ?, ?, 'concluido', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Pedido concluído demonstrativo", 39.50, null, clienteId,
        petgId, qualidadeDetalheId, stlConcluidoId, JSON.stringify({ preenchimento: 30 }), 2,
        "gcode_storage/dev/pedido_concluido_demo.gcode", 10800, 65.0000, 0.3000, 35.00, 0.00, 4.50,
        3.00, 72.00, 0,
      ],
    );
    const pedidoAnaliseId = await insert(
      `INSERT INTO pedidos (
         nome, preco, descricao, status, id_usuario, id_material, id_qualidade, id_arquivo,
         parametros, quantidade, prazo_entrega_horas, prioridade_paga
       ) VALUES (?, 0, ?, 'analisando', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "Pedido em análise demonstrativo", "Sem G-code enquanto a análise está pendente.", adminId,
        absId, qualidadeSuporteId, stlAnaliseId, JSON.stringify({ preenchimento: 15 }), 1, 96.00, 0,
      ],
    );

    await connection.execute(
      "UPDATE arquivos SET id_pedido = CASE id WHEN ? THEN ? WHEN ? THEN ? WHEN ? THEN ? END WHERE id IN (?, ?, ?)",
      [stlFilaId, pedidoFilaId, stlConcluidoId, pedidoConcluidoId, stlAnaliseId, pedidoAnaliseId, stlFilaId, stlConcluidoId, stlAnaliseId],
    );
    await insert(
      "INSERT INTO arquivos (id_pedido, nome, tipo, caminho, tamanho_mb) VALUES (?, ?, 'gcode', ?, ?)",
      [pedidoFilaId, "pedido_fila_demo.gcode", "gcode_storage/dev/pedido_fila_demo.gcode", 4.200],
    );
    await insert(
      "INSERT INTO arquivos (id_pedido, nome, tipo, caminho, tamanho_mb) VALUES (?, ?, 'gcode', ?, ?)",
      [pedidoConcluidoId, "pedido_concluido_demo.gcode", "gcode_storage/dev/pedido_concluido_demo.gcode", 6.800],
    );

    const k2ProId = await insert(
      `INSERT INTO impressoras (
         nome, modelo, possui_cfs, largura_mesa_mm, profundidade_mesa_mm,
         status, api, timeout_ms, status_fisico, capacidade_dia_horas
       ) VALUES (?, ?, 1, ?, ?, 'Ociosa', 'DUMMY', 15000, 'idle', 8.00)`,
      ["Impressora demo 1", "K2 Pro", 300.00, 300.00],
    );
    const crealityHiId = await insert(
      `INSERT INTO impressoras (
         nome, modelo, possui_cfs, largura_mesa_mm, profundidade_mesa_mm,
         status, api, timeout_ms, status_fisico, capacidade_dia_horas
       ) VALUES (?, ?, 1, ?, ?, 'Ociosa', 'DUMMY', 15000, 'idle', 8.00)`,
      ["Impressora demo 2", "Creality Hi", 260.00, 260.00],
    );
    const enderId = await insert(
      `INSERT INTO impressoras (
         nome, modelo, possui_cfs, largura_mesa_mm, profundidade_mesa_mm,
         status, api, timeout_ms, status_fisico, capacidade_dia_horas
       ) VALUES (?, ?, 0, ?, ?, 'Manutenção', 'DUMMY', 15000, 'maintenance', 8.00)`,
      ["Impressora demo 3", "Ender 3 V3 SE", 220.00, 220.00],
    );

    await connection.execute(
      `INSERT INTO impressora_slots_filamento (id_impressora, numero_slot, id_material)
       VALUES (?, 1, ?), (?, 2, ?), (?, 1, ?), (?, 2, ?), (?, 1, ?)`,
      [
        k2ProId, plaId,
        k2ProId, petgId,
        crealityHiId, petgId,
        crealityHiId, absId,
        enderId, absId,
      ],
    );

    await insert(
      `INSERT INTO pedido_impressora (
         id_pedido, id_impressora, status, posicao_fila,
         numero_slot_planejado, requer_troca_manual, tentativas_inicio,
         proxima_tentativa_em, inicio_previsto_horas,
         conclusao_prevista_horas, custo, setup_horas, risco_esperado_horas,
         tempo_total_horas, atraso_horas
       ) VALUES (?, ?, 'na_fila', 1, 1, 0, 0, NULL, 0, 2.20, 0.20, 0.20, 0, 2.20, 0)`,
      [pedidoFilaId, k2ProId],
    );
    await insert(
      "INSERT INTO impressora_eventos (id_impressora, tipo, mensagem, payload_json) VALUES (?, ?, ?, ?)",
      [k2ProId, "seed_created", "Impressora DUMMY criada pelo seed de desenvolvimento.", JSON.stringify({ protocol: "DUMMY" })],
    );
    await insert(
      "INSERT INTO impressora_eventos (id_impressora, tipo, mensagem) VALUES (?, ?, ?)",
      [crealityHiId, "seed_created", "Impressora DUMMY criada pelo seed de desenvolvimento."],
    );
    await insert(
      "INSERT INTO impressora_eventos (id_impressora, tipo, mensagem) VALUES (?, ?, ?)",
      [enderId, "seed_created", "Impressora DUMMY de manutenção criada pelo seed de desenvolvimento."],
    );
    await insert(
      "INSERT INTO chat_mensagens (id_pedido, id_remetente, tipo_remetente, mensagem, lido) VALUES (?, ?, 'cliente', ?, 0)",
      [pedidoFilaId, clienteId, "Mensagem genérica do cliente para validar o chat."],
    );
    await insert(
      "INSERT INTO chat_mensagens (id_pedido, id_remetente, tipo_remetente, mensagem, lido) VALUES (?, ?, 'admin', ?, 1)",
      [pedidoFilaId, adminId, "Resposta genérica do administrador para validar o chat."],
    );

    await connection.commit();
    transactionStarted = false;
    console.log(`[db:seed] Dados genéricos inseridos com sucesso no banco ${database}.`);
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    throw error;
  } finally {
    if (locked) await connection.execute("SELECT RELEASE_LOCK(?)", [lock]).catch(() => undefined);
    connection.release();
  }
}

if (require.main === module) {
  seedDevelopmentData()
    .catch((error: any) => {
      console.error(`[db:seed] ERRO: ${error?.message ?? error}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await db.end();
    });
}
