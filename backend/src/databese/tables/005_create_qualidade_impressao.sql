CREATE TABLE qualidade (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip_pedido INT NOT NULL UNIQUE,
    altuta DECIMAL(4,2) NOT NULL,
    espessura DECIMAL(4,2) NOT NULL,
    preenchimento INT NOT NULL,
    velocidade INT NOT NULL,
    temperatura_bico INT NOT NULL,
    temperatura_mesa INT NOT NULL,
    suporte INT NOT NULL,
    adesao INT NOT NULL,

    FOREIGN KEY (id_pedido) REFERENCES pedidos(id)
        ON DELETE CASCADE
);