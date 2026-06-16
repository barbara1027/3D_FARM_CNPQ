CREATE TABLE IF NOT EXISTS chat_mensagens (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  id_pedido       INT NOT NULL,
  id_remetente    INT NOT NULL,
  tipo_remetente  ENUM('admin', 'cliente') NOT NULL,
  mensagem        TEXT NOT NULL,
  lido            TINYINT(1) NOT NULL DEFAULT 0,
  criado_em       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_pedido
    FOREIGN KEY (id_pedido)    REFERENCES pedidos(id)   ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_chat_remetente
    FOREIGN KEY (id_remetente) REFERENCES usuarios(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_chat_pedido     (id_pedido),
  INDEX idx_chat_nao_lidas  (id_pedido, tipo_remetente, lido)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
