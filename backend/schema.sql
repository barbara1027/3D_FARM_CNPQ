CREATE DATABASE IF NOT EXISTS `3d_farm`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `3d_farm`;

-- -----------------------------------------------------------------
-- usuarios
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(120)  NOT NULL,
  email       VARCHAR(200)  NOT NULL UNIQUE,
  senha_hash  VARCHAR(255)  NULL,
  google_id   VARCHAR(100)  NULL UNIQUE,
  avatar_url  VARCHAR(512)  NULL,
  tipo        ENUM('admin','cliente') NOT NULL DEFAULT 'cliente',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- materiais
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS materiais (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(100)   NOT NULL,
  tipo       VARCHAR(80)    NOT NULL,
  preco      DECIMAL(10,4)  NOT NULL DEFAULT 0,
  status     ENUM('disponivel','indisponivel') NOT NULL DEFAULT 'disponivel',
  cor        VARCHAR(50)    NOT NULL DEFAULT '',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- qualidades
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS qualidades (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome              VARCHAR(100) NOT NULL DEFAULT '',
  altura            DECIMAL(5,3) NOT NULL,
  espessura         DECIMAL(5,3) NOT NULL,
  preenchimento     TINYINT UNSIGNED NOT NULL,
  velocidade        SMALLINT UNSIGNED NOT NULL,
  temperatura_bico  SMALLINT UNSIGNED NOT NULL,
  temperatura_mesa  SMALLINT UNSIGNED NOT NULL,
  suporte           TINYINT(1) NOT NULL DEFAULT 0,
  adesao            TINYINT(1) NOT NULL DEFAULT 0,
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- arquivos
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS arquivos (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome       VARCHAR(255)   NOT NULL,
  tipo       ENUM('stl','gcode') NOT NULL,
  caminho    VARCHAR(512)   NOT NULL,
  tamanho_mb DECIMAL(10,3)  NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- pedidos (ATUALIZADA)
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pedidos (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome                VARCHAR(200)  NOT NULL,
  preco               DECIMAL(10,2) NOT NULL DEFAULT 0,
  descricao           TEXT NULL,
  -- Novos status para o fluxo de análise e pagamento [cite: 153]
  status              ENUM('analisando', 'aguardando_pagamento', 'aguardando_revisao', 'na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado') NOT NULL DEFAULT 'analisando',
  id_usuario          INT UNSIGNED NOT NULL,
  id_material         INT UNSIGNED NOT NULL,
  id_qualidade        INT UNSIGNED NOT NULL,
  id_arquivo          INT UNSIGNED NOT NULL,
  
  -- Campos de análise do Slicer e Precificação detalhada [cite: 274]
  parametros          JSON NULL,             -- Guarda layerHeight, infill, etc. [cite: 262]
  gcode_path          VARCHAR(512) NULL,     -- Caminho do arquivo gerado [cite: 272]
  tempo_estimado_s    INT UNSIGNED NULL,     -- Tempo em segundos [cite: 274]
  material_gramas     DECIMAL(10,4) NULL,    -- Peso do material [cite: 274]
  score_complexidade  DECIMAL(5,4) NULL,     -- Score 0-1 [cite: 274]
  motivo_complexidade TEXT NULL,             -- Texto para o admin [cite: 274]
  preco_base          DECIMAL(10,2) NULL,    -- Subtotal sem taxas extras [cite: 274]
  taxa_complexidade   DECIMAL(10,2) NULL,    -- Sobretaxa de risco [cite: 274]
  taxa_stripe         DECIMAL(10,2) NULL,    -- Taxa embutida do gateway [cite: 274]

  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  CONSTRAINT fk_pedido_usuario   FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_pedido_material  FOREIGN KEY (id_material)  REFERENCES materiais(id)  ON DELETE RESTRICT,
  CONSTRAINT fk_pedido_qualidade FOREIGN KEY (id_qualidade) REFERENCES qualidades(id) ON DELETE RESTRICT,
  CONSTRAINT fk_pedido_arquivo   FOREIGN KEY (id_arquivo)   REFERENCES arquivos(id)   ON DELETE RESTRICT
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- impressoras
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impressoras (
  id                   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome                 VARCHAR(120) NOT NULL,
  modelo               VARCHAR(120) NOT NULL,
  status               ENUM('Ociosa','Reservada','Imprimindo','Pausada','Indisponivel','Aguardando Remoção','Erro','Manutenção') NOT NULL DEFAULT 'Ociosa',
  ip                   VARCHAR(45)  NULL,
  base_url             VARCHAR(255) NULL,
  api                  ENUM('OCTOPRINT','MOONRAKER','DUMMY') NOT NULL DEFAULT 'OCTOPRINT',
  api_key              VARCHAR(255) NULL,
  timeout_ms           INT UNSIGNED NOT NULL DEFAULT 15000,
  status_fisico        VARCHAR(120) NULL,
  job_remoto_id        VARCHAR(255) NULL,
  ultimo_erro          TEXT NULL,
  ultima_sincronizacao DATETIME NULL,
  id_material          INT UNSIGNED NULL,
  created_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_impressora_material FOREIGN KEY (id_material) REFERENCES materiais(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- -----------------------------------------------------------------
-- impressora_eventos
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS impressora_eventos (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_impressora INT UNSIGNED NOT NULL,
  tipo          VARCHAR(60)  NOT NULL,
  mensagem      TEXT NOT NULL,
  payload_json  JSON NULL,
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_evento_impressora FOREIGN KEY (id_impressora) REFERENCES impressoras(id) ON DELETE CASCADE
) ENGINE=InnoDB;