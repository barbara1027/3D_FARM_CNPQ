CREATE TYPE printer_status AS ENUM ('Ociosa', 'Imprimindo', 'Indisponivel', 'Aguardando Remoção');
CREATE TYPE api_protocol AS ENUM ('OCTOPRINT', 'MOONRAKER', 'DUMMY');

CREATE TABLE impressoras(
    id INT AUTO_INCREMENT PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    modelo VARCHAR(100) NOT NULL,
    status printer_status NOT NULL DEFAULT 'Ociosa',
    ip INET,
    api api_protocol NOT NULL DEFAULT 'DUMMY',
    api_key VARCHAR(255),
);