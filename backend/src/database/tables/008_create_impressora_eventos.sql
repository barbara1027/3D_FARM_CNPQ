CREATE TABLE IF NOT EXISTS impressora_eventos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_impressora INT NOT NULL,
  tipo VARCHAR(60) NOT NULL,
  mensagem VARCHAR(255) NOT NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evento_impressora
    FOREIGN KEY (id_impressora) REFERENCES impressoras(id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
