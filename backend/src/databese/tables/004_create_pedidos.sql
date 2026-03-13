DROP TYPE IF EXISTS status_pedido CASCADE;
CREATE TYPE status_pedido AS ENUM ('na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado');

CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    preco decimal(10,2) NOT NULL,
    descricao TEXT,
    id_usuario INT NOT NULL,
    id_material INT NOT NULL,
    Id_qualidade INT NOT NULL,
    id_arquivo INT NOT NULL,
    status status_pedido NOT NULL DEFAULT 'na_fila',

    FOREIGN KEY (id_usuario) REFERENCES usuario(id)
    FOREIGN KEY (id_material) REFERENCES material(id),
    FOREIGN KEY (Id_qualidade) REFERENCES qualidade(id),
    FOREIGN KEY (id_arquivo ) REFERENCES arquivo(id),
);