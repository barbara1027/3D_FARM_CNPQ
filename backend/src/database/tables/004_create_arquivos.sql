CREATE TABLE `arquivos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_pedido` INT UNSIGNED NULL,
  `nome` VARCHAR(255) NOT NULL,
  `tipo` ENUM('stl', 'gcode') NOT NULL,
  `caminho` VARCHAR(512) NOT NULL,
  `tamanho_mb` DECIMAL(12,3) NOT NULL DEFAULT 0.000,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_arquivos_pedido_tipo` (`id_pedido`, `tipo`),
  CONSTRAINT `chk_arquivos_tamanho_nonnegative` CHECK (`tamanho_mb` >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
