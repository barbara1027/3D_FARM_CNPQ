-- Registro mínimo de pagamentos (Fase 10). `event_id` é único: garante que
-- o mesmo evento do Stripe (reentregue por retry/duplicidade do webhook)
-- nunca é processado duas vezes — a idempotência é imposta pelo banco, não
-- só por lógica de aplicação.
CREATE TABLE `pagamentos` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `id_pedido` INT UNSIGNED NOT NULL,
  `provider` VARCHAR(30) NOT NULL DEFAULT 'stripe',
  `payment_intent_id` VARCHAR(255) NULL,
  `event_id` VARCHAR(255) NOT NULL,
  `status` VARCHAR(30) NOT NULL,
  `valor` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pagamentos_event_id` (`event_id`),
  KEY `idx_pagamentos_pedido` (`id_pedido`),
  CONSTRAINT `fk_pagamentos_pedido` FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id`) ON DELETE CASCADE ON UPDATE RESTRICT,
  CONSTRAINT `chk_pagamentos_valor_nonnegative` CHECK (`valor` >= 0)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
