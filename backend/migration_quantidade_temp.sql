-- Migration: faixas de temperatura por material + quantidade e parametros por pedido
-- Executar com:
--   mysql -u root 3d_farm < backend/migration_quantidade_temp.sql

-- Adiciona parametros JSON e quantidade em pedidos (ignora erro se coluna já existir)
ALTER TABLE pedidos
  ADD COLUMN parametros  JSON NULL              AFTER id_arquivo;

ALTER TABLE pedidos
  ADD COLUMN quantidade  SMALLINT UNSIGNED NOT NULL DEFAULT 1 AFTER parametros;

-- Faixas de temperatura nos materiais
ALTER TABLE materiais
  ADD COLUMN temp_bico_min SMALLINT UNSIGNED NULL AFTER cor;
ALTER TABLE materiais
  ADD COLUMN temp_bico_max SMALLINT UNSIGNED NULL AFTER temp_bico_min;
ALTER TABLE materiais
  ADD COLUMN temp_mesa_min SMALLINT UNSIGNED NULL AFTER temp_bico_max;
ALTER TABLE materiais
  ADD COLUMN temp_mesa_max SMALLINT UNSIGNED NULL AFTER temp_mesa_min;

-- Faixas típicas por tipo de filamento (ajuste conforme necessário)
UPDATE materiais SET temp_bico_min = 180, temp_bico_max = 220, temp_mesa_min = 50,  temp_mesa_max = 60  WHERE tipo LIKE '%PLA%';
UPDATE materiais SET temp_bico_min = 220, temp_bico_max = 250, temp_mesa_min = 80,  temp_mesa_max = 110 WHERE tipo LIKE '%ABS%';
UPDATE materiais SET temp_bico_min = 220, temp_bico_max = 245, temp_mesa_min = 70,  temp_mesa_max = 85  WHERE tipo LIKE '%PETG%';
UPDATE materiais SET temp_bico_min = 220, temp_bico_max = 240, temp_mesa_min = 45,  temp_mesa_max = 65  WHERE tipo LIKE '%TPU%';
UPDATE materiais SET temp_bico_min = 250, temp_bico_max = 280, temp_mesa_min = 80,  temp_mesa_max = 110 WHERE tipo LIKE '%ASA%';

-- Vinculo entre impressora e pedido em andamento
ALTER TABLE impressoras
  ADD COLUMN id_pedido_atual INT UNSIGNED NULL AFTER id_material;
