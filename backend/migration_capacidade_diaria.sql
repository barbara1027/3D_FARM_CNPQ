-- Migration: rastreamento real de capacidade diária por impressora
-- Necessário para o gatilho automático de atribuição de pedidos: sem isso,
-- o sistema não tem como saber quantas horas de produção já foram
-- comprometidas hoje em cada impressora.
-- Executar com:
--   mysql -u root 3d_farm < backend/migration_capacidade_diaria.sql

ALTER TABLE impressoras
  ADD COLUMN horas_usadas_hoje DECIMAL(8,2) NOT NULL DEFAULT 0
    COMMENT 'Horas de produção já atribuídas hoje. Zera automaticamente quando data_referencia_capacidade muda.',
  ADD COLUMN data_referencia_capacidade DATE NULL
    COMMENT 'Data a que horas_usadas_hoje se refere — vira o "hoje" real via comparação, sem precisar de job de reset.';
