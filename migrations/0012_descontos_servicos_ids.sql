-- ================================================
-- MIGRATION 0012 — Adicionar coluna servicos_ids à tabela descontos
--
-- PROBLEMA: A coluna servicos_ids foi adicionada ao código (API e frontend)
-- mas não existia na migration 0011 nem na base de dados em produção.
-- Esta migration adiciona a coluna de forma segura (ADD COLUMN é seguro no SQLite).
--
-- Executar:
--   wrangler d1 execute barbearia-brooklyn --remote --file=migrations/0012_descontos_servicos_ids.sql
-- ================================================

-- Guarda um JSON array com os IDs dos serviços abrangidos pelo desconto.
-- NULL ou '[]' = aplica-se a todos os serviços.
ALTER TABLE descontos ADD COLUMN servicos_ids TEXT DEFAULT NULL;
