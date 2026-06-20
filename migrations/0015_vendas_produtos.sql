-- ================================================
-- MIGRATION 0015 — Vendas de Produtos
-- Executar em instâncias existentes (D1 wrangler d1 execute)
-- ================================================

-- 1. Tabela de categorias de produtos ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produto_categorias (
  id          INTEGER  PRIMARY KEY AUTOINCREMENT,
  nome        TEXT     NOT NULL,
  descricao   TEXT,
  ordem       INTEGER  NOT NULL DEFAULT 0,
  ativo       INTEGER  NOT NULL DEFAULT 1,
  criado_em   DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produto_categorias_ativo ON produto_categorias(ativo);

-- 2. Tabela de produtos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  categoria_id  INTEGER  NOT NULL REFERENCES produto_categorias(id) ON DELETE RESTRICT,
  nome          TEXT     NOT NULL,
  descricao     TEXT,
  preco_centimos INTEGER NOT NULL DEFAULT 0,
  ordem         INTEGER  NOT NULL DEFAULT 0,
  ativo         INTEGER  NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo        ON produtos(ativo);

-- 3. Tabela de vendas de produtos ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produto_vendas (
  id                  INTEGER  PRIMARY KEY AUTOINCREMENT,
  admin_user_id       INTEGER  NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  cliente_id          INTEGER  REFERENCES clientes(id) ON DELETE SET NULL,
  total_centimos      INTEGER  NOT NULL DEFAULT 0,
  meio_pagamento      TEXT     NOT NULL,
  notas               TEXT,
  criado_em           DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produto_vendas_admin_user_id ON produto_vendas(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_produto_vendas_cliente_id   ON produto_vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produto_vendas_criado_em    ON produto_vendas(criado_em);

-- 4. Tabela de itens de venda ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS produto_venda_itens (
  id              INTEGER  PRIMARY KEY AUTOINCREMENT,
  venda_id        INTEGER  NOT NULL REFERENCES produto_vendas(id) ON DELETE CASCADE,
  produto_id      INTEGER  NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade      INTEGER  NOT NULL DEFAULT 1,
  preco_unitario_centimos INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produto_venda_itens_venda_id   ON produto_venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_produto_venda_itens_produto_id ON produto_venda_itens(produto_id);

-- 5. View de vendas completas ──────────────────────────────────────────────────
DROP VIEW IF EXISTS v_produto_vendas_complete;
CREATE VIEW v_produto_vendas_complete AS
SELECT
  pv.id,
  pv.admin_user_id,
  au.nome        AS admin_user_nome,
  pv.cliente_id,
  c.nome         AS cliente_nome,
  c.telefone     AS cliente_telefone,
  pv.total_centimos,
  pv.meio_pagamento,
  pv.notas,
  pv.criado_em
FROM produto_vendas pv
JOIN admin_users au ON pv.admin_user_id = au.id
LEFT JOIN clientes c ON pv.cliente_id = c.id;
