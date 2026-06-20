-- 0014_clientes_bloqueio.sql
-- Adiciona campos de bloqueio de cliente.

ALTER TABLE clientes ADD COLUMN bloqueado            INTEGER  NOT NULL DEFAULT 0;
ALTER TABLE clientes ADD COLUMN bloqueado_motivo    TEXT     DEFAULT NULL;
ALTER TABLE clientes ADD COLUMN bloqueado_por_admin INTEGER  REFERENCES admin_users(id) ON DELETE SET NULL;
ALTER TABLE clientes ADD COLUMN bloqueado_em        DATETIME DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_clientes_bloqueado ON clientes(bloqueado);
