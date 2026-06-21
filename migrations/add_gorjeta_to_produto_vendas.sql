-- Migração: adicionar gorjeta, meio_gorjeta, oferta_tipo, oferta_valor à tabela produto_vendas
-- e campo oferta à tabela produto_venda_itens
-- Executar manualmente via Cloudflare D1: wrangler d1 execute <DB_NAME> --file=migrations/add_gorjeta_to_produto_vendas.sql

ALTER TABLE produto_vendas ADD COLUMN gorjeta      INTEGER DEFAULT NULL;
ALTER TABLE produto_vendas ADD COLUMN meio_gorjeta TEXT    DEFAULT NULL;
ALTER TABLE produto_vendas ADD COLUMN oferta_tipo  TEXT    DEFAULT NULL;
ALTER TABLE produto_vendas ADD COLUMN oferta_valor INTEGER DEFAULT NULL;

ALTER TABLE produto_venda_itens ADD COLUMN oferta INTEGER NOT NULL DEFAULT 0;
