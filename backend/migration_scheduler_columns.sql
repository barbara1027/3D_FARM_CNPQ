-- Migration: colunas do scheduler de fila de impressão
-- Executar com: mysql -u root 3d_farm < backend/migration_scheduler_columns.sql
-- ATENÇÃO: rodar apenas UMA vez (MySQL não tem ADD COLUMN IF NOT EXISTS)

ALTER TABLE pedidos
  ADD COLUMN tempo_gcode_horas         DECIMAL(7,2) NULL        AFTER taxa_stripe,
  ADD COLUMN prazo_entrega_horas        DECIMAL(7,2) NULL        AFTER tempo_gcode_horas,
  ADD COLUMN prazo_entrega              DATETIME     NULL        AFTER prazo_entrega_horas,
  ADD COLUMN eta_horas_estimado         DECIMAL(8,2) NULL        AFTER prazo_entrega,
  ADD COLUMN eta_calculado_em           DATETIME     NULL        AFTER eta_horas_estimado,
  ADD COLUMN prazo_entrega_original     DATETIME     NULL        AFTER eta_calculado_em,
  ADD COLUMN limite_inicio_impressao    DATETIME     NULL        AFTER prazo_entrega_original,
  ADD COLUMN prioridade_paga            BOOLEAN      NOT NULL DEFAULT FALSE AFTER limite_inicio_impressao,
  ADD COLUMN tempo_maximo_espera_horas  DECIMAL(8,2) NULL        AFTER prioridade_paga,
  ADD COLUMN buffer_prioridade_horas    DECIMAL(8,2) NULL        AFTER tempo_maximo_espera_horas,
  ADD COLUMN buffer_seguranca_horas     DECIMAL(8,2) NULL        AFTER buffer_prioridade_horas,
  ADD COLUMN tempo_exec_farm_horas      DECIMAL(8,2) NULL        AFTER buffer_seguranca_horas;

ALTER TABLE impressoras
  ADD COLUMN eficiencia                   DECIMAL(5,2) NOT NULL DEFAULT 1.00  AFTER id_pedido_atual,
  ADD COLUMN taxa_erro_recente            DECIMAL(5,4) NOT NULL DEFAULT 0.0000 AFTER eficiencia,
  ADD COLUMN tempo_para_ficar_livre_horas DECIMAL(7,2) NOT NULL DEFAULT 0.00  AFTER taxa_erro_recente,
  ADD COLUMN capacidade_dia_horas         DECIMAL(7,2) NOT NULL DEFAULT 8.00  AFTER tempo_para_ficar_livre_horas;
