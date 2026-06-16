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
  
  -- Campos de análise do Slicer e Precificação detalhada
  parametros          JSON NULL,
  quantidade          INT UNSIGNED NOT NULL DEFAULT 1,
  gcode_path          VARCHAR(512) NULL,
  tempo_estimado_s    INT UNSIGNED NULL,
  material_gramas     DECIMAL(10,4) NULL,
  score_complexidade  DECIMAL(5,4) NULL,
  motivo_complexidade TEXT NULL,
  preco_base          DECIMAL(10,2) NULL,
  taxa_complexidade   DECIMAL(10,2) NULL,
  taxa_stripe         DECIMAL(10,2) NULL,

  -- Campos de fila e ETA
  tempo_gcode_horas         DECIMAL(7,2) NULL,
  prazo_entrega_horas       DECIMAL(7,2) NULL,
  prazo_entrega             DATETIME NULL,
  eta_horas_estimado        DECIMAL(8,2) NULL,
  eta_calculado_em          DATETIME NULL,
  prazo_entrega_original    DATETIME NULL,
  limite_inicio_impressao   DATETIME NULL,
  prioridade_paga           BOOLEAN NOT NULL DEFAULT FALSE,
  tempo_maximo_espera_horas DECIMAL(8,2) NULL,
  buffer_prioridade_horas   DECIMAL(8,2) NULL,
  buffer_seguranca_horas    DECIMAL(8,2) NULL,
  tempo_exec_farm_horas     DECIMAL(8,2) NULL,

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
  id_material                  INT UNSIGNED NULL,
  id_pedido_atual              INT UNSIGNED NULL,
  eficiencia                   DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  taxa_erro_recente            DECIMAL(5,4) NOT NULL DEFAULT 0.0000,
  tempo_para_ficar_livre_horas DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  capacidade_dia_horas         DECIMAL(7,2) NOT NULL DEFAULT 8.00,
  created_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
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

-- -----------------------------------------------------------------
-- chat_mensagens
-- -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_mensagens (
  id             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  id_pedido      INT UNSIGNED NOT NULL,
  id_remetente   INT UNSIGNED NOT NULL,
  tipo_remetente ENUM('admin','cliente') NOT NULL,
  mensagem       TEXT NOT NULL,
  lido           TINYINT(1) NOT NULL DEFAULT 0,
  criado_em      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_chat_pedido    FOREIGN KEY (id_pedido)    REFERENCES pedidos(id)   ON DELETE CASCADE  ON UPDATE CASCADE,
  CONSTRAINT fk_chat_remetente FOREIGN KEY (id_remetente) REFERENCES usuarios(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  INDEX idx_chat_pedido    (id_pedido),
  INDEX idx_chat_nao_lidas (id_pedido, tipo_remetente, lido)
) ENGINE=InnoDB;