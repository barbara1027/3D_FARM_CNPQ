
CREATE TABLE pedido_impressora (
    id SERIAL PRIMARY KEY,
    id_pedido INT NOT NULL,
    id_impressora INT NOT NULL,
    status ,
    prioridade INT NOT NULL,
    posicao_fila INT NOT NULL,

    FOREIGN KEY (id_pedido) REFERENCES pedidos(id),
    FOREIGN KEY (id_impressora) REFERENCES impressoras(id)
);