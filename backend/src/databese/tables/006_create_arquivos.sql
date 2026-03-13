CREATE TYPE tipo_arquivo As ENUM ('stl','gcode');

CREATE TABLE gcode (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    caminho_arquivo VARCHAR(255),
    tipo tipo_arquivo NOT NULL,


    FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
);