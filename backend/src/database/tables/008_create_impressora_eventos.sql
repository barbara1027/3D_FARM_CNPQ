CREATE TABLE `impressora_eventos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_impressora` INT UNSIGNED NOT NULL,
  `tipo` VARCHAR(60) NOT NULL,
  `mensagem` TEXT NOT NULL,
  `payload_json` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_impressora_eventos_impressora_created_at` (`id_impressora`, `created_at`, `id`),
  CONSTRAINT `fk_impressora_eventos_impressora` FOREIGN KEY (`id_impressora`) REFERENCES `impressoras` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
