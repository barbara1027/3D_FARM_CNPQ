CREATE TABLE IF NOT EXISTS impressoras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(100) NOT NULL UNIQUE,
  modelo VARCHAR(100) NOT NULL,
  status ENUM(
    'Ociosa',
    'Reservada',
    'Imprimindo',
    'Pausada',
    'Indisponivel',
    'Aguardando Remoção',
    'Erro',
    'Manutenção'
  ) NOT NULL DEFAULT 'Ociosa',
  ip VARCHAR(45) NULL,
  base_url VARCHAR(255) NULL,
  api ENUM('OCTOPRINT', 'MOONRAKER', 'DUMMY') NOT NULL DEFAULT 'DUMMY',
  api_key VARCHAR(255) NULL,
  timeout_ms INT NOT NULL DEFAULT 15000,
  status_fisico VARCHAR(120) NULL,
  job_remoto_id VARCHAR(255) NULL,
  ultimo_erro TEXT NULL,
  ultima_sincronizacao TIMESTAMP NULL,
  id_material INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_impressora_material
    FOREIGN KEY (id_material) REFERENCES materiais(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
