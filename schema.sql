-- ================================================
-- Brooklyn Barbearia Template — D1 Database Schema
-- Compatible: Cloudflare D1 (SQLite dialect)
-- ================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ================================================
-- ADMINS
-- ================================================
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    DEFAULT (datetime('now'))
);

-- ================================================
-- CLIENTES
-- ================================================
CREATE TABLE IF NOT EXISTS clientes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nome          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE,
  telefone      TEXT,
  nif           TEXT,
  photo_url     TEXT,
  password_hash TEXT,
  created_at    TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_clientes_email ON clientes(email);

-- ================================================
-- BARBEIROS
-- ================================================
CREATE TABLE IF NOT EXISTS barbeiros (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome      TEXT    NOT NULL,
  foto_url  TEXT,
  ativo     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT   DEFAULT (datetime('now'))
);

-- ================================================
-- SERVIÇOS
-- ================================================
CREATE TABLE IF NOT EXISTS servicos (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  nome    TEXT    NOT NULL,
  duracao INTEGER NOT NULL DEFAULT 60,  -- minutos
  preco   INTEGER NOT NULL DEFAULT 0,   -- cêntimos (€ * 100)
  ativo   INTEGER NOT NULL DEFAULT 1,
  ordem   INTEGER NOT NULL DEFAULT 0
);

-- ================================================
-- RESERVAS
-- ================================================
CREATE TABLE IF NOT EXISTS reservas (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id       INTEGER NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  barbeiro_id      INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE RESTRICT,
  servico_id       INTEGER NOT NULL REFERENCES servicos(id)  ON DELETE RESTRICT,
  data_hora        TEXT    NOT NULL,  -- ISO 8601: YYYY-MM-DDTHH:MM:SS
  status           TEXT    NOT NULL DEFAULT 'confirmada'
                     CHECK (status IN ('pendente','confirmada','concluida','cancelada','faltou')),
  comentario       TEXT,
  duracao_minutos  INTEGER,
  created_by       TEXT    NOT NULL DEFAULT 'online'
                     CHECK (created_by IN ('online','admin')),
  created_at       TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_reservas_data        ON reservas(data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_barbeiro    ON reservas(barbeiro_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente     ON reservas(cliente_id,  data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_status_data ON reservas(status, data_hora);

-- ================================================
-- HORÁRIOS INDISPONÍVEIS
-- ================================================
CREATE TABLE IF NOT EXISTS horarios_indisponiveis (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  barbeiro_id       INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
  data_hora_inicio  TEXT    NOT NULL,
  data_hora_fim     TEXT    NOT NULL,
  is_all_day        INTEGER NOT NULL DEFAULT 0,
  tipo              TEXT    NOT NULL DEFAULT 'folga'
                      CHECK (tipo IN ('folga','ferias','formacao','outro')),
  motivo            TEXT,
  created_at        TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_indisponiveis_barbeiro ON horarios_indisponiveis(barbeiro_id, data_hora_inicio);

-- ================================================
-- VIEW: reservas com duração (compat. Brooklyn)
-- ================================================
CREATE VIEW IF NOT EXISTS v_reservas_duracao AS
  SELECT
    r.*,
    COALESCE(r.duracao_minutos, s.duracao, 60) AS duracao_calculada
  FROM reservas r
  JOIN servicos s ON s.id = r.servico_id;

-- ================================================
-- SEED: Admin padrão
-- Alterar password antes de usar em produção!
-- hash de 'admin123' (PBKDF2-SHA256)
-- ================================================
-- INSERT INTO admins (nome, email, password_hash)
-- VALUES ('Admin', 'admin@barbearia.pt', '<hash>');

-- ================================================
-- SEED: Dados de exemplo
-- ================================================
INSERT OR IGNORE INTO servicos (id, nome, duracao, preco, ordem) VALUES
  (1, 'Corte de Cabelo',       45, 1200, 1),
  (2, 'Barba',                 30,  800, 2),
  (3, 'Corte + Barba',         60, 1800, 3),
  (4, 'Corte Máquina',         30,  900, 4),
  (5, 'Hidratação Capilar',   30, 1500, 5),
  (6, 'Corte Infantil',        30,  900, 6);

INSERT OR IGNORE INTO barbeiros (id, nome, ativo) VALUES
  (1, 'João',  1),
  (2, 'Pedro', 1),
  (3, 'Tiago', 1);
