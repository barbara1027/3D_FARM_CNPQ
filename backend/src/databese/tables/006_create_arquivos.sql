DROP TYPE IF EXISTS tipo_arquivo CASCADE;
CREATE TYPE tipo_arquivo As ENUM ('stl','gcode');

CREATE TABLE arquivo (
    id SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    caminho_arquivo VARCHAR(255),
    tipo tipo_arquivo NOT NULL,


    FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
);