-- Migration: parâmetros avançados por material e qualidade
-- Executar com:
--   mysql -u root 3d_farm < backend/migration_parametros_avancados.sql
-- Pré-requisito: migration_quantidade_temp.sql já executado

-- ─── materiais: propriedades físicas do filamento ─────────────────────────────

ALTER TABLE materiais
  ADD COLUMN diametro   DECIMAL(4,2)       NOT NULL DEFAULT 1.75;

ALTER TABLE materiais
  ADD COLUMN fan_min    TINYINT UNSIGNED   NULL;

ALTER TABLE materiais
  ADD COLUMN fan_max    TINYINT UNSIGNED   NULL;

ALTER TABLE materiais
  ADD COLUMN camada_min DECIMAL(3,2)       NULL;

ALTER TABLE materiais
  ADD COLUMN camada_max DECIMAL(3,2)       NULL;

-- Defaults de fábrica por tipo de filamento
-- PLA: exige boa refrigeração, camadas finas possíveis
UPDATE materiais
  SET fan_min = 50, fan_max = 100, camada_min = 0.08, camada_max = 0.30,
      temp_bico_min = 195, temp_bico_max = 220, temp_mesa_min = 50, temp_mesa_max = 60
  WHERE tipo LIKE '%PLA%';

-- ABS: sensível a correntes de ar, requer cama aquecida alta
UPDATE materiais
  SET fan_min = 0, fan_max = 25, camada_min = 0.10, camada_max = 0.30,
      temp_bico_min = 220, temp_bico_max = 255, temp_mesa_min = 100, temp_mesa_max = 115
  WHERE tipo LIKE '%ABS%';

-- PETG: refrigeração moderada, boa adesão
UPDATE materiais
  SET fan_min = 30, fan_max = 50, camada_min = 0.10, camada_max = 0.30,
      temp_bico_min = 225, temp_bico_max = 245, temp_mesa_min = 70, temp_mesa_max = 90
  WHERE tipo LIKE '%PETG%';

-- TPU: flexível, precisa de velocidade lenta, não pode ter camadas muito finas
UPDATE materiais
  SET fan_min = 0, fan_max = 50, camada_min = 0.15, camada_max = 0.35,
      temp_bico_min = 210, temp_bico_max = 240, temp_mesa_min = 25, temp_mesa_max = 45
  WHERE tipo LIKE '%TPU%';

-- ASA: como ABS mas com maior resistência UV, sem fan
UPDATE materiais
  SET fan_min = 0, fan_max = 20, camada_min = 0.10, camada_max = 0.30,
      temp_bico_min = 240, temp_bico_max = 265, temp_mesa_min = 95, temp_mesa_max = 110
  WHERE tipo LIKE '%ASA%';

-- Nylon: alta temperatura, pouco fan
UPDATE materiais
  SET fan_min = 0, fan_max = 30, camada_min = 0.10, camada_max = 0.30,
      temp_bico_min = 240, temp_bico_max = 270, temp_mesa_min = 70, temp_mesa_max = 90
  WHERE tipo LIKE '%Nylon%' OR tipo LIKE '%PA%';

-- ─── qualidades: parâmetros estruturais de impressão ─────────────────────────

ALTER TABLE qualidades
  ADD COLUMN perimetros     TINYINT UNSIGNED NOT NULL DEFAULT 2;

ALTER TABLE qualidades
  ADD COLUMN camadas_topo   TINYINT UNSIGNED NOT NULL DEFAULT 3;

ALTER TABLE qualidades
  ADD COLUMN camadas_base   TINYINT UNSIGNED NOT NULL DEFAULT 3;

ALTER TABLE qualidades
  ADD COLUMN angulo_suporte TINYINT UNSIGNED NOT NULL DEFAULT 45;

-- Normal (~0.20mm): velocidade sobre detalhe, uso geral
UPDATE qualidades
  SET perimetros = 2, camadas_topo = 3, camadas_base = 3, angulo_suporte = 45
  WHERE altura BETWEEN 0.18 AND 0.22;

-- Qualidade (~0.16mm): bom equilíbrio detalhe/velocidade
UPDATE qualidades
  SET perimetros = 3, camadas_topo = 4, camadas_base = 4, angulo_suporte = 50
  WHERE altura BETWEEN 0.14 AND 0.18;

-- Alta qualidade (~0.12mm): máximo detalhe, lento
UPDATE qualidades
  SET perimetros = 3, camadas_topo = 5, camadas_base = 5, angulo_suporte = 50
  WHERE altura BETWEEN 0.08 AND 0.14;
