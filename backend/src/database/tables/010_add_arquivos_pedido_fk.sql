-- Único ALTER permitido no bootstrap: resolve a FK circular arquivos ↔ pedidos.
-- Nenhuma coluna é adicionada depois dos CREATE TABLE.
ALTER TABLE `arquivos`
  ADD CONSTRAINT `fk_arquivos_pedido`
  FOREIGN KEY (`id_pedido`) REFERENCES `pedidos` (`id`)
  ON DELETE SET NULL
  ON UPDATE RESTRICT;
