-- Migration: temperatura recomendada nos materiais + remover temp e preenchimento de qualidades
-- Executar com:
--   mysql -u root 3d_farm < backend/migration_temp_material_infill.sql
-- Pré-requisito: migration_quantidade_temp.sql e migration_parametros_avancados.sql já executados

-- ─── materiais: adiciona temperatura única recomendada (além das faixas min/max) ─

ALTER TABLE materiais
  ADD COLUMN temp_bico_recomendada SMALLINT UNSIGNED NULL AFTER temp_bico_max;

ALTER TABLE materiais
  ADD COLUMN temp_mesa_recomendada SMALLINT UNSIGNED NULL AFTER temp_mesa_max;

-- Preenche com ponto médio das faixas já existentes
UPDATE materiais
  SET temp_bico_recomendada = ROUND((temp_bico_min + temp_bico_max) / 2)
  WHERE temp_bico_min IS NOT NULL AND temp_bico_max IS NOT NULL;

UPDATE materiais
  SET temp_mesa_recomendada = ROUND((temp_mesa_min + temp_mesa_max) / 2)
  WHERE temp_mesa_min IS NOT NULL AND temp_mesa_max IS NOT NULL;

-- ─── qualidades: remove campos que pertencem ao material ─────────────────────────

-- Temperatura do bico depende do filamento, não da resolução de impressão
ALTER TABLE qualidades DROP COLUMN temperatura_bico;

-- Temperatura da mesa depende da aderência do filamento, não da resolução
ALTER TABLE qualidades DROP COLUMN temperatura_mesa;

-- Preenchimento passa a ser escolhido pelo usuário no pedido (parametros JSON)
ALTER TABLE qualidades DROP COLUMN preenchimento;
