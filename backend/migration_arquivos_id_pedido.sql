-- Vincula arquivos ao pedido que os gerou/usa
ALTER TABLE arquivos ADD COLUMN id_pedido INT UNSIGNED NULL AFTER id;
CREATE INDEX idx_arquivos_id_pedido ON arquivos (id_pedido);

-- Backfill: STLs já vinculados via pedidos.id_arquivo
UPDATE arquivos a
  JOIN pedidos p ON p.id_arquivo = a.id
  SET a.id_pedido = p.id
  WHERE a.tipo = 'stl';

-- Backfill: GCodes existentes em pedidos.gcode_path
INSERT INTO arquivos (id_pedido, nome, tipo, caminho, tamanho_mb)
  SELECT
    p.id,
    CONCAT('pedido_', p.id, '.gcode'),
    'gcode',
    p.gcode_path,
    0
  FROM pedidos p
  WHERE p.gcode_path IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM arquivos a WHERE a.id_pedido = p.id AND a.tipo = 'gcode'
    );
