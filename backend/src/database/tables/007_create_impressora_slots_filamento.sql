CREATE TABLE `impressora_slots_filamento` (
  `id_impressora` INT UNSIGNED NOT NULL,
  `numero_slot` TINYINT UNSIGNED NOT NULL,
  `id_material` INT UNSIGNED NOT NULL,
  PRIMARY KEY (`id_impressora`, `numero_slot`),
  KEY `idx_impressora_slots_filamento_material` (`id_material`),
  CONSTRAINT `fk_slot_filamento_impressora` FOREIGN KEY (`id_impressora`) REFERENCES `impressoras` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_slot_filamento_material` FOREIGN KEY (`id_material`) REFERENCES `materiais` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `chk_numero_slot_positivo` CHECK (`numero_slot` BETWEEN 1 AND 4)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
