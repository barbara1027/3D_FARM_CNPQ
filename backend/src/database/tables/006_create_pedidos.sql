CREATE TABLE IF NOT EXISTS pedidos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  descricao TEXT NULL,
  id_usuario INT NOT NULL,
  id_material INT NOT NULL,
  id_qualidade INT NOT NULL,
  id_arquivo INT NOT NULL,
  status ENUM('na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado') NOT NULL DEFAULT 'na_fila',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pedido_usuario
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_material
    FOREIGN KEY (id_material) REFERENCES materiais(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_qualidade
    FOREIGN KEY (id_qualidade) REFERENCES qualidades(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_arquivo
    FOREIGN KEY (id_arquivo) REFERENCES arquivos(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
