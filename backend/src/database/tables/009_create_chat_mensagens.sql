CREATE TABLE `chat_mensagens` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_pedido` INT UNSIGNED NOT NULL,
  `id_remetente` INT UNSIGNED NOT NULL,
  `tipo_remetente` ENUM('admin', 'cliente') NOT NULL,
  `mensagem` TEXT NOT NULL,
  `lido` TINYINT UNSIGNED NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_chat_pedido_created_at` (`id_pedido`, `created_at`, `id`),
  KEY `idx_chat_nao_lidas` (`id_pedido`, `tipo_remetente`, `lido`),
  KEY `idx_chat_tipo_lido_pedido` (`tipo_remetente`, `lido`, `id_pedido`),
  KEY `idx_chat_remetente` (`id_remetente`),
  CONSTRAINT `fk_chat_mensagens_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `fk_chat_mensagens_remetente` FOREIGN KEY (`id_remetente`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `chk_chat_mensagens_lido_boolean` CHECK (`lido` IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
