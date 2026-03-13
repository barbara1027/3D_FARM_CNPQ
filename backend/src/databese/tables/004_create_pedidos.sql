DROP TYPE IF EXISTS status_pedido CASCADE;
CREATE TYPE status_pedido AS ENUM ('na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado');

CREATE TABLE pedidos (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    status status_pedido NOT NULL DEFAULT 'na_fila',
    preco decimal(10,2) NOT NULL,
    caminho_stl VARCHAR(255),
    descricao TEXT,
    id_material INT NOT NULL,
    Id_qualidade INT NOT NULL,
    id_arquivo INT NOT NULL,
    id_usuario INT NOT NULL,

    FOREIGN KEY (id_material) REFERENCES material(id),
    FOREIGN KEY (Id_qualidade) REFERENCES qualidade(id),
    FOREIGN KEY (id_usuario) REFERENCES usuario(id)
);