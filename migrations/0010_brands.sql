-- Tabela de marcas parceiras para o carrossel da homepage
CREATE TABLE IF NOT EXISTS marcas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  logo_url    TEXT,
  website_url TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);
