CREATE TYPE status_pedido AS ENUM ('na_fila', 'em_impressao', 'concluido', 'falhou', 'cancelado');

CREATE TABLE pedidos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    status status_pedido NOT NULL DEFAULT 'na_fila',
    preco decimal(10,2) NOT NULL,
    caminho_stl VARCHAR(255),
    descricao TEXT,
    id_material INT NOT NULL,
    id_gcode INT NOT NULL,
    id_usuusuario INT NOT NULL,

    FOREIGN KEY (id_material) REFERENCES material(id),
    FOREIGN KEY (id_gcode) REFERENCES gcode(id),
    FOREIGN KEY (id_usuusuario) REFERENCESusuario(id)
);