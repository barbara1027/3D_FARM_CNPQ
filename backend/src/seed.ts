/**
 * Seed — 3D Farm
 *
 * Popula o banco com dados de operação cobrindo todos os casos do sistema.
 * Usuários NÃO são criados aqui — use o cadastro normal ou o Google OAuth.
 *
 * O seed assume que já existe pelo menos 1 usuário no banco.
 * Se não tiver, crie um primeiro via: POST /usuarios
 *
 * Uso: npm run seed
 */

import "dotenv/config";
import { db } from "./database/connection";

async function seed() {
  console.log("🌱 Iniciando seed...\n");

  // ── Verificar se existe pelo menos 1 usuário ──────────────────────────────
  const [usuariosExistentes]: any = await db.execute(
    "SELECT id, tipo FROM usuarios ORDER BY id LIMIT 10"
  );

  if (!usuariosExistentes || usuariosExistentes.length === 0) {
    console.error(`
❌ Nenhum usuário encontrado no banco.

Crie pelo menos um usuário antes de rodar o seed:

  curl -X POST http://localhost:3333/usuarios \\
    -H "Content-Type: application/json" \\
    -d '{"nome":"Admin","email":"admin@3dfarm.com","senha":"admin123","tipo":"admin"}'

  curl -X POST http://localhost:3333/usuarios \\
    -H "Content-Type: application/json" \\
    -d '{"nome":"Ana Clara","email":"ana@cliente.com","senha":"cliente123","tipo":"cliente"}'

Depois rode npm run seed novamente.
    `);
    await db.end();
    process.exit(1);
  }

  // Pega o primeiro admin e o primeiro cliente disponíveis
  const admin = usuariosExistentes.find((u: any) => u.tipo === "admin");
  const clientes = usuariosExistentes.filter((u: any) => u.tipo === "cliente");

  if (!admin) {
    console.error("❌ Nenhum usuário admin encontrado. Crie um admin primeiro.");
    await db.end();
    process.exit(1);
  }

  const idAdmin = admin.id;
  // Se não tiver cliente, usa o próprio admin para os pedidos de teste
  const idCliente1 = clientes[0]?.id ?? idAdmin;
  const idCliente2 = clientes[1]?.id ?? idCliente1;
  const idCliente3 = clientes[2]?.id ?? idCliente1;

  console.log(`✓ Usuários encontrados — admin: id=${idAdmin}, clientes: ${clientes.map((c: any) => c.id).join(", ") || "usando admin"}`);

  // ── Limpar tabelas de dados (mantém usuários) ─────────────────────────────
  await db.execute("SET FOREIGN_KEY_CHECKS = 0");
  await db.execute("TRUNCATE TABLE impressora_eventos");
  await db.execute("TRUNCATE TABLE impressoras");
  await db.execute("TRUNCATE TABLE pedidos");
  await db.execute("TRUNCATE TABLE arquivos");
  await db.execute("TRUNCATE TABLE qualidades");
  await db.execute("TRUNCATE TABLE materiais");
  await db.execute("SET FOREIGN_KEY_CHECKS = 1");
  console.log("✓ Tabelas de dados limpas (usuários mantidos)");

  // ── Materiais ─────────────────────────────────────────────────────────────
  await db.execute(`
    INSERT INTO materiais (nome, tipo, preco, status, cor) VALUES
    ('PLA Branco',        'PLA',    0.1200, 'disponivel',   'Branco'),
    ('PLA Preto',         'PLA',    0.1200, 'disponivel',   'Preto'),
    ('PETG Transparente', 'PETG',   0.1800, 'disponivel',   'Transparente'),
    ('ABS Cinza',         'ABS',    0.1500, 'disponivel',   'Cinza'),
    ('Resina Flex',       'Resina', 0.3500, 'indisponivel', 'Bege')
  `);
  console.log("✓ Materiais criados (4 disponíveis, 1 indisponível)");

  // ── Qualidades ────────────────────────────────────────────────────────────
  await db.execute(`
    INSERT INTO qualidades (nome, altura, espessura, preenchimento, velocidade, temperatura_bico, temperatura_mesa, suporte, adesao) VALUES
    ('Normal',         0.200, 1.2, 20, 60, 210, 60, 0, 0),
    ('Qualidade',      0.150, 1.6, 25, 50, 215, 60, 0, 0),
    ('Alta Qualidade', 0.100, 2.0, 30, 40, 215, 60, 1, 1)
  `);
  console.log("✓ Qualidades criadas (Normal, Qualidade, Alta Qualidade)");

  // ── Arquivos (paths fictícios — o sistema não precisa dos arquivos físicos para exibir) ──
  await db.execute(`
    INSERT INTO arquivos (nome, tipo, caminho, tamanho_mb) VALUES
    ('suporte_camera.stl',     'stl',   'uploads/fake_suporte_camera.stl',    2.40),
    ('engrenagem_v2.stl',      'stl',   'uploads/fake_engrenagem_v2.stl',     1.10),
    ('caixa_arduino.stl',      'stl',   'uploads/fake_caixa_arduino.stl',     5.80),
    ('helice_drone.stl',       'stl',   'uploads/fake_helice_drone.stl',      0.90),
    ('suporte_camera.gcode',   'gcode', 'uploads/fake_suporte_camera.gcode',  8.20),
    ('engrenagem_v2.gcode',    'gcode', 'uploads/fake_engrenagem_v2.gcode',   3.50)
  `);
  console.log("✓ Arquivos criados");

  // ── Pedidos (todos os status possíveis) ───────────────────────────────────
  await db.execute(`
    INSERT INTO pedidos (nome, preco, descricao, status, id_usuario, id_material, id_qualidade, id_arquivo, created_at) VALUES

    -- na_fila: aguardando serem processados
    ('Suporte de Câmera GoPro', 0.00,
      'Precisa de acabamento fino na borda.',
      'na_fila', ?, 1, 2, 1, NOW() - INTERVAL 1 HOUR),

    ('Engrenagem Robótica V2', 0.00,
      NULL,
      'na_fila', ?, 3, 1, 2, NOW() - INTERVAL 30 MINUTE),

    -- em_impressao: sendo produzido agora
    ('Caixa para Arduino Mega', 45.90,
      'Precisa de espaço interno para os cabos USB.',
      'em_impressao', ?, 4, 1, 3, NOW() - INTERVAL 3 HOUR),

    -- concluido: entregue com sucesso
    ('Suporte Mesa Ajustável', 38.50,
      NULL,
      'concluido', ?, 2, 2, 1, NOW() - INTERVAL 2 DAY),

    ('Peça de Reposição Impressora', 22.00,
      'Urgente — manutenção programada.',
      'concluido', ?, 1, 1, 2, NOW() - INTERVAL 5 DAY),

    ('Tampa de Proteção Sensor', 15.00,
      NULL,
      'concluido', ?, 1, 3, 5, NOW() - INTERVAL 7 DAY),

    -- falhou: problema durante produção
    ('Hélice Drone Miniatura', 0.00,
      'Arquivo com problema de geometria — faces invertidas.',
      'falhou', ?, 2, 3, 4, NOW() - INTERVAL 1 DAY),

    ('Engrenagem Pequena M2', 0.00,
      NULL,
      'falhou', ?, 3, 2, 2, NOW() - INTERVAL 4 DAY),

    -- cancelado: cancelado pelo cliente ou admin
    ('Capa Celular Customizada', 12.00,
      'Cliente cancelou antes do início da impressão.',
      'cancelado', ?, 1, 1, 1, NOW() - INTERVAL 3 DAY),

    ('Base Suporte Monitor', 67.00,
      'Cancelado a pedido do cliente — mudança de especificação.',
      'cancelado', ?, 4, 2, 3, NOW() - INTERVAL 6 DAY)
  `, [
    idCliente1,  // na_fila 1
    idCliente2,  // na_fila 2
    idCliente1,  // em_impressao
    idCliente2,  // concluido 1
    idCliente3,  // concluido 2
    idCliente1,  // concluido 3
    idCliente2,  // falhou 1
    idCliente3,  // falhou 2
    idCliente1,  // cancelado 1
    idCliente2,  // cancelado 2
  ]);
  console.log("✓ Pedidos criados (2 na_fila · 1 em_impressao · 3 concluido · 2 falhou · 2 cancelado)");

  // ── Impressoras ───────────────────────────────────────────────────────────
  await db.execute(`
    INSERT INTO impressoras (nome, modelo, status, ip, base_url, api, timeout_ms, status_fisico, id_material) VALUES
    ('Ender 3 Pro',     'Creality Ender 3 Pro', 'Imprimindo', '192.168.1.101',
      'http://192.168.1.101', 'DUMMY', 15000, 'printing', 1),
    ('Bambu X1 Carbon', 'Bambu Lab X1 Carbon',  'Ociosa',     '192.168.1.102',
      'http://192.168.1.102', 'DUMMY', 15000, 'idle',     2),
    ('Prusa MK4',       'Prusa Research MK4',   'Manutenção', NULL,
      NULL, 'DUMMY', 15000, NULL, NULL)
  `);
  console.log("✓ Impressoras criadas (1 Imprimindo · 1 Ociosa · 1 Manutenção)");

  // ── Eventos das impressoras ───────────────────────────────────────────────
  await db.execute(`
    INSERT INTO impressora_eventos (id_impressora, tipo, mensagem) VALUES
    (1, 'job_started',  'Pedido 3 enviado para a impressora.'),
    (1, 'health_check', 'Conexão DUMMY OK — simulação ativa.'),
    (2, 'health_check', 'Modo DUMMY: conexão simulada com sucesso.'),
    (3, 'status_sync',  'Impressora colocada em manutenção pelo administrador.')
  `);
  console.log("✓ Eventos de impressora criados");

  await db.end();

  console.log(`
╔══════════════════════════════════════════════════╗
║         Seed concluído com sucesso! 🎉           ║
╠══════════════════════════════════════════════════╣
║  Dados criados:                                  ║
║  • 5 materiais  (4 disponíveis, 1 indisponível)  ║
║  • 3 qualidades (Normal, Qualidade, Alta)        ║
║  • 6 arquivos   (4 STL + 2 G-code)               ║
║  • 10 pedidos   (todos os status possíveis)      ║
║  • 3 impressoras (Imprimindo, Ociosa, Manutenção)║
╚══════════════════════════════════════════════════╝
  `);
}

seed().catch((err) => {
  console.error("❌ Erro no seed:", err.message ?? err);
  process.exit(1);
});