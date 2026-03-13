
CREATE TABLE pedido_impressora (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_impressora INT NOT NULL,
    status ,
    posicao_fila INT NOT NULL,

    FOREIGN KEY (id_pedido) REFERENCES pedidos(id),
    FOREIGN KEY (id_impressora) REFERENCES impressoras(id)
);