SET @column_exists := (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'pedidos'
    AND COLUMN_NAME = 'limite_inicio_impressao'
);

SET @sql := IF(
  @column_exists = 0,
  'ALTER TABLE pedidos ADD COLUMN limite_inicio_impressao DATETIME NULL AFTER prazo_entrega_original',
  'SELECT ''Coluna limite_inicio_impressao ja existe em pedidos'' AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
