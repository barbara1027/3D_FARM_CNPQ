CREATE TABLE IF NOT EXISTS pedidos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  nome                VARCHAR(200) NOT NULL,
  preco               DECIMAL(10,2) NOT NULL DEFAULT 0,
  descricao           TEXT NULL,
  status              ENUM(
    'analisando',
    'aguardando_pagamento',
    'aguardando_revisao',
    'na_fila',
    'em_impressao',
    'concluido',
    'falhou',
    'cancelado'
  ) NOT NULL DEFAULT 'analisando',
  id_usuario          INT NOT NULL,
  id_material         INT NOT NULL,
  id_qualidade        INT NOT NULL,
  id_arquivo          INT NOT NULL,

  -- Slicer / pricing
  parametros          JSON NULL,
  quantidade          INT NOT NULL DEFAULT 1,
  gcode_path          VARCHAR(512) NULL,
  tempo_estimado_s    INT UNSIGNED NULL,
  material_gramas     DECIMAL(10,4) NULL,
  score_complexidade  DECIMAL(5,4) NULL,
  motivo_complexidade TEXT NULL,
  preco_base          DECIMAL(10,2) NULL,
  taxa_complexidade   DECIMAL(10,2) NULL,
  taxa_stripe         DECIMAL(10,2) NULL,

  -- Queue / ETA
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

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pedido_usuario
    FOREIGN KEY (id_usuario)   REFERENCES usuarios(id)   ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_material
    FOREIGN KEY (id_material)  REFERENCES materiais(id)  ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_qualidade
    FOREIGN KEY (id_qualidade) REFERENCES qualidades(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_pedido_arquivo
    FOREIGN KEY (id_arquivo)   REFERENCES arquivos(id)   ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
