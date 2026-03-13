CREATE TABLE qualidades (
    id SERIAL PRIMARY KEY,
    altura DECIMAL(4,2) NOT NULL,
    espessura DECIMAL(4,2) NOT NULL,
    preenchimento INT NOT NULL,
    velocidade INT NOT NULL,
    temperatura_bico INT NOT NULL,
    temperatura_mesa INT NOT NULL,
    suporte INT NOT NULL,
    adesao INT NOT NULL,
);