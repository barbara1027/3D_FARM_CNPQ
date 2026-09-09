CREATE TABLE `materiais` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT,
  `nome` VARCHAR(100) NOT NULL,
  `tipo` VARCHAR(80) NOT NULL,
  `cor` VARCHAR(50) NOT NULL,
  `preco` DECIMAL(10,4) NOT NULL DEFAULT 0.0000,
  `status` ENUM('disponivel', 'indisponivel') NOT NULL DEFAULT 'disponivel',
  `temp_bico_min` SMALLINT UNSIGNED NULL,
  `temp_bico_max` SMALLINT UNSIGNED NULL,
  `temp_bico_recomendada` SMALLINT UNSIGNED NULL,
  `temp_mesa_min` SMALLINT UNSIGNED NULL,
  `temp_mesa_max` SMALLINT UNSIGNED NULL,
  `temp_mesa_recomendada` SMALLINT UNSIGNED NULL,
  `diametro` DECIMAL(4,2) NOT NULL DEFAULT 1.75,
  `fan_min` TINYINT UNSIGNED NULL,
  `fan_max` TINYINT UNSIGNED NULL,
  `camada_min` DECIMAL(4,3) NULL,
  `camada_max` DECIMAL(4,3) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `chk_materiais_preco_nonnegative` CHECK (`preco` >= 0),
  CONSTRAINT `chk_materiais_diametro_positive` CHECK (`diametro` > 0),
  CONSTRAINT `chk_materiais_fan_min_range` CHECK (`fan_min` IS NULL OR `fan_min` BETWEEN 0 AND 100),
  CONSTRAINT `chk_materiais_fan_max_range` CHECK (`fan_max` IS NULL OR `fan_max` BETWEEN 0 AND 100),
  CONSTRAINT `chk_materiais_fan_range_order` CHECK (`fan_min` IS NULL OR `fan_max` IS NULL OR `fan_min` <= `fan_max`),
  CONSTRAINT `chk_materiais_temp_bico_order` CHECK (`temp_bico_min` IS NULL OR `temp_bico_max` IS NULL OR `temp_bico_min` <= `temp_bico_max`),
  CONSTRAINT `chk_materiais_temp_bico_recomendada` CHECK (
    `temp_bico_recomendada` IS NULL OR
    ((`temp_bico_min` IS NULL OR `temp_bico_recomendada` >= `temp_bico_min`) AND
     (`temp_bico_max` IS NULL OR `temp_bico_recomendada` <= `temp_bico_max`))
  ),
  CONSTRAINT `chk_materiais_temp_mesa_order` CHECK (`temp_mesa_min` IS NULL OR `temp_mesa_max` IS NULL OR `temp_mesa_min` <= `temp_mesa_max`),
  CONSTRAINT `chk_materiais_temp_mesa_recomendada` CHECK (
    `temp_mesa_recomendada` IS NULL OR
    ((`temp_mesa_min` IS NULL OR `temp_mesa_recomendada` >= `temp_mesa_min`) AND
     (`temp_mesa_max` IS NULL OR `temp_mesa_recomendada` <= `temp_mesa_max`))
  ),
  CONSTRAINT `chk_materiais_camada_min_positive` CHECK (`camada_min` IS NULL OR `camada_min` > 0),
  CONSTRAINT `chk_materiais_camada_max_positive` CHECK (`camada_max` IS NULL OR `camada_max` > 0),
  CONSTRAINT `chk_materiais_camada_order` CHECK (`camada_min` IS NULL OR `camada_max` IS NULL OR `camada_min` <= `camada_max`)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
