-- Unidade física de execução de um pedido. Um pedido com quantidade > 1 gera
-- um job por unidade (Fase 6): a fila passa a planejar/atribuir impressoras
-- por job, e um pedido só é marcado 'concluido' quando todos os seus jobs
-- terminam. Reimpressão abre um novo lote de jobs para o mesmo pedido.
CREATE TABLE `jobs_impressao` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_pedido` INT UNSIGNED NOT NULL,
  `indice_unidade` INT UNSIGNED NOT NULL,
  `status` ENUM('pendente', 'em_impressao', 'concluido', 'falhou', 'cancelado') NOT NULL DEFAULT 'pendente',
  `id_impressora` INT UNSIGNED NULL,
  `tempo_previsto_horas` DECIMAL(8,2) NULL,
  `tempo_real_horas` DECIMAL(8,2) NULL,
  `tentativas` SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  `erro` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `started_at` DATETIME NULL,
  `finished_at` DATETIME NULL,
  PRIMARY KEY (`id`),
  KEY `idx_jobs_impressao_pedido_status` (`id_pedido`, `status`),
  KEY `idx_jobs_impressao_impressora` (`id_impressora`),
  CONSTRAINT `fk_jobs_impressao_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_jobs_impressao_impressora` FOREIGN KEY (`id_impressora`) REFERENCES `impressoras` (`id`) ON DELETE SET NULL ON UPDATE RESTRICT,
  CONSTRAINT `chk_jobs_impressao_indice_positive` CHECK (`indice_unidade` > 0),
  CONSTRAINT `chk_jobs_impressao_tempo_previsto_nonnegative` CHECK (`tempo_previsto_horas` IS NULL OR `tempo_previsto_horas` >= 0),
  CONSTRAINT `chk_jobs_impressao_tempo_real_nonnegative` CHECK (`tempo_real_horas` IS NULL OR `tempo_real_horas` >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
