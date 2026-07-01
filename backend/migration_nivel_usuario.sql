-- Migration: adiciona campo nivel (iniciante/avancado) à tabela usuarios
-- Executar com: mysql -u root 3d_farm < backend/migration_nivel_usuario.sql
-- ATENÇÃO: rodar apenas UMA vez

ALTER TABLE usuarios
  ADD COLUMN nivel ENUM('iniciante', 'avancado') NOT NULL DEFAULT 'iniciante' AFTER tipo;

-- Definir níveis dos usuários existentes
UPDATE usuarios SET nivel = 'avancado' WHERE email = 'babizinha.1027@gmail.com';
UPDATE usuarios SET nivel = 'iniciante' WHERE email = 'ana@cliente.com';
