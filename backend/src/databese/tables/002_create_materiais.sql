CREATE TABLE materiais (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    preco decimal(10,2) NOT NULL,
    status ENUM('disponivel', 'indisponivel') NOT NULL,
    cor VARCHAR(50) NOT NULL
);