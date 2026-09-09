CREATE TABLE `usuarios` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(120) NOT NULL,
  `email` VARCHAR(200) NOT NULL,
  `senha_hash` VARCHAR(255) NULL,
  `google_id` VARCHAR(100) NULL,
  `avatar_url` VARCHAR(512) NULL,
  `tipo` ENUM('admin', 'cliente') NOT NULL DEFAULT 'cliente',
  `nivel` ENUM('iniciante', 'avancado') NOT NULL DEFAULT 'iniciante',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`),
  UNIQUE KEY `uq_usuarios_google_id` (`google_id`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
