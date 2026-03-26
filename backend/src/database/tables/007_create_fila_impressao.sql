CREATE TABLE IF NOT EXISTS pedido_impressora (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido INT NOT NULL,
  id_impressora INT NOT NULL,
  status ENUM('na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado') NOT NULL DEFAULT 'na_fila',
  prioridade INT NOT NULL DEFAULT 0,
  posicao_fila INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_fila_pedido
    FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_fila_impressora
    FOREIGN KEY (id_impressora) REFERENCES impressoras(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
