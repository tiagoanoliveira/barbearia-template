-- ================================================
-- Compatible: Cloudflare D1 (SQLite dialect)
-- NOTA: PRAGMA journal_mode e foreign_keys não são
-- suportados pelo D1 — omitidos intencionalmente.
-- ================================================

-- ================================================
-- CLIENTES
-- ================================================
CREATE TABLE IF NOT EXISTS clientes (
  id                        INTEGER PRIMARY KEY AUTOINCREMENT,
  nome                      TEXT    NOT NULL,
  email                     TEXT    NOT NULL UNIQUE,
  email_pendente            TEXT,
  telefone                  TEXT,
  password_hash             TEXT    NOT NULL,
  email_verificado          BOOLEAN DEFAULT 1,
  token_verificacao         TEXT,
  token_reset_password      TEXT,
  token_reset_expira        DATETIME,
  criado_em                 DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em             DATETIME DEFAULT CURRENT_TIMESTAMP,
  google_id                 TEXT,
  facebook_id               TEXT,
  instagram_id              TEXT,
  auth_methods              TEXT    DEFAULT 'password',
  token_verificacao_expira  TEXT,
  reservas_concluidas       INTEGER DEFAULT 0,
  reservas_gratuitas_disponiveis INTEGER DEFAULT 0,
  nif                       INTEGER,
  next_appointment_date     DATETIME,
  last_appointment_date     DATETIME,
  notas                     TEXT,
  foto_perfil               TEXT,
  resend_reset_email_id        TEXT,
  resend_verification_email_id TEXT,
  resend_email_change_id       TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clientes_email_unique      ON clientes(email);
CREATE INDEX        IF NOT EXISTS idx_clientes_email             ON clientes(email);
CREATE INDEX        IF NOT EXISTS idx_clientes_telefone          ON clientes(telefone);
CREATE INDEX        IF NOT EXISTS idx_clientes_next_appointment  ON clientes(next_appointment_date);
CREATE INDEX        IF NOT EXISTS idx_clientes_token_verificacao ON clientes(token_verificacao);
CREATE INDEX        IF NOT EXISTS idx_google_id                  ON clientes(google_id);
CREATE INDEX        IF NOT EXISTS idx_facebook_id                ON clientes(facebook_id);
CREATE INDEX        IF NOT EXISTS idx_instagram_id               ON clientes(instagram_id);
CREATE INDEX        IF NOT EXISTS idx_auth_methods               ON clientes(auth_methods);

-- ================================================
-- BARBEIROS
-- ================================================
CREATE TABLE IF NOT EXISTS barbeiros (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nome           TEXT    NOT NULL,
  especialidades TEXT    NOT NULL DEFAULT '',
  foto           TEXT,
  ativo          INTEGER DEFAULT 1,
  color          TEXT    DEFAULT '#ffffff'
);

CREATE INDEX IF NOT EXISTS idx_barbeiros_ativo ON barbeiros(ativo);

-- ================================================
-- SERVIÇOS
-- ================================================
CREATE TABLE IF NOT EXISTS servicos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nome       TEXT    NOT NULL,
  preco      INTEGER NOT NULL DEFAULT 0,
  duracao    INTEGER DEFAULT 60,
  svg        TEXT    NOT NULL DEFAULT 'null',
  abreviacao TEXT    NOT NULL DEFAULT 'null',
  color      TEXT    NOT NULL DEFAULT '#000000'
);

CREATE TABLE servico_barbeiro (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  servico_id INTEGER NOT NULL REFERENCES servicos(id) ON DELETE CASCADE,
  barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
  preco      INTEGER,       -- NULL = usa o preço base do serviço
  duracao    INTEGER,       -- NULL = usa a duração base do serviço
  ativo      INTEGER NOT NULL DEFAULT 1,
  UNIQUE(servico_id, barbeiro_id)
);

-- Tabela de marcas parceiras para o carrossel da homepage
CREATE TABLE IF NOT EXISTS marcas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  nome        TEXT    NOT NULL,
  logo_url    TEXT,
  website_url TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  criado_em   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ================================================
-- RESERVAS
-- ================================================
CREATE TABLE IF NOT EXISTS reservas (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente_id             INTEGER NOT NULL REFERENCES clientes(id)  ON DELETE CASCADE,
  barbeiro_id            INTEGER NOT NULL REFERENCES barbeiros(id),
  servico_id             INTEGER NOT NULL REFERENCES servicos(id),
  data_hora              DATETIME NOT NULL,
  comentario             TEXT,
  nota_privada           TEXT,
  status                 TEXT DEFAULT 'confirmada'
                           CHECK(status IN ('confirmada','concluida','cancelada','faltou')),
  criado_em              DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em          DATETIME DEFAULT CURRENT_TIMESTAMP,
  historico_edicoes      TEXT DEFAULT '[]',
  moloni_document_id     INTEGER,
  moloni_document_number TEXT,
  created_by             TEXT CHECK(created_by IN ('online','admin','barbeiro')),
  duracao_minutos        INTEGER DEFAULT NULL,
  wpp_lembrete           INTEGER DEFAULT 1,
  -- ID do email de lembrete agendado na Resend (para poder cancelar / reagendar)
  resend_lembrete_id     TEXT,

  -- ── Pagamento ───────────────────────────────────────────────────────────────────────
  -- Meio de pagamento do serviço (null = ainda não pago / não registado)
  meio_pagamento         TEXT    DEFAULT NULL,
  -- Valor efectivamente pago em cêntimos (INTEGER evita erros de vírgula flutuante)
  valor_pago             INTEGER DEFAULT NULL,
  -- Gorjeta em cêntimos (null = sem gorjeta registada)
  gorjeta                INTEGER DEFAULT NULL,
  -- Meio de pagamento da gorjeta (pode diferir do meio principal)
  meio_gorjeta           TEXT    DEFAULT NULL,
  -- Comentário livre sobre o pagamento (obrigatório quando meio = 'outro')
    comentario_pagamento   TEXT    DEFAULT NULL,

    -- ── Oferta / Fidelização ────────────────────────────────────────────────────────────
    -- Valor oferecido em cêntimos (null = sem oferta; 0 = oferta total)
    oferta_valor           INTEGER DEFAULT NULL,
    -- Tipo de oferta (ex: 'fidelizacao', 'promocao', 'cortesia', etc.)
    oferta_tipo            TEXT    DEFAULT NULL);

CREATE INDEX IF NOT EXISTS idx_reservas_cliente_data          ON reservas(cliente_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_barbeiro_data_status  ON reservas(barbeiro_id, data_hora, status);
CREATE INDEX IF NOT EXISTS idx_reservas_created_by            ON reservas(created_by);
CREATE INDEX IF NOT EXISTS idx_reservas_status_data           ON reservas(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_disponibilidade       ON reservas(barbeiro_id, data_hora, status);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_status_data   ON reservas(cliente_id, status, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_moloni_document       ON reservas(moloni_document_id);
CREATE INDEX IF NOT EXISTS idx_reservas_resend_lembrete       ON reservas(resend_lembrete_id);
CREATE INDEX IF NOT EXISTS idx_reservas_meio_pagamento        ON reservas(meio_pagamento, status, data_hora);

-- ================================================
-- HORÁRIOS INDISPONÍVEIS
-- ================================================
CREATE TABLE IF NOT EXISTS horarios_indisponiveis (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  barbeiro_id         INTEGER NOT NULL REFERENCES barbeiros(id),
  data_hora_inicio    TEXT    NOT NULL,
  data_hora_fim       TEXT    NOT NULL,
  tipo                TEXT    NOT NULL DEFAULT 'folga'
                        CHECK(tipo IN ('folga','almoco','ferias','ausencia','outro')),
  motivo              TEXT,
  is_all_day          INTEGER DEFAULT 0,
  recurrence_type     TEXT    DEFAULT 'none'
                        CHECK(recurrence_type IN ('none','daily','weekly')),
  recurrence_end_date TEXT,
  recurrence_group_id TEXT,
  created_at          TEXT    DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_horarios_barbeiro_datas ON horarios_indisponiveis(barbeiro_id, data_hora_inicio, data_hora_fim);
CREATE INDEX IF NOT EXISTS idx_horarios_recorrencia    ON horarios_indisponiveis(recurrence_type, recurrence_end_date);

-- ================================================
-- ADMIN USERS
-- ================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  nome          TEXT    NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin'
        CHECK(role IN ('admin','barbeiro','superAdmin')),
  barbeiro_id   INTEGER REFERENCES barbeiros(id) ON DELETE CASCADE,
  ativo         INTEGER DEFAULT 1,
  criado_em     DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  ultimo_login  DATETIME
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username    ON admin_users(username);
CREATE INDEX IF NOT EXISTS idx_admin_users_role        ON admin_users(role);
CREATE INDEX IF NOT EXISTS idx_admin_users_barbeiro_id ON admin_users(barbeiro_id);

-- ================================================
-- NOTIFICATIONS
-- ================================================
CREATE TABLE IF NOT EXISTS notifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  type           TEXT    NOT NULL,
  message        TEXT    NOT NULL,
  reservation_id INTEGER,
  client_name    TEXT,
  barber_id      INTEGER,
  is_read        INTEGER DEFAULT 0,
  created_at     DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_is_read     ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at  ON notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_barber      ON notifications(barber_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_unread      ON notifications(is_read, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_reservation ON notifications(reservation_id, created_at);

-- ================================================
-- ESTATÍSTICAS DIÁRIAS (cache de stats por barbeiro/dia)
-- ================================================
CREATE TABLE IF NOT EXISTS daily_stats (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  data          TEXT    NOT NULL, -- 'YYYY-MM-DD'
  barbeiro_id   INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
  confirmadas   INTEGER DEFAULT 0,
  concluidas    INTEGER DEFAULT 0,
  canceladas    INTEGER DEFAULT 0,
  faltas        INTEGER DEFAULT 0,
  atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(data, barbeiro_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_data       ON daily_stats(data);
CREATE INDEX IF NOT EXISTS idx_daily_stats_barbeiro   ON daily_stats(barbeiro_id, data);
CREATE INDEX IF NOT EXISTS idx_daily_stats_data_range ON daily_stats(data, barbeiro_id);

-- ================================================
-- TRIGGERS
-- ================================================

-- ────────────────────────────────────────────────────────────────────────────
-- SISTEMA DE FIDELIZAÇÃO
--
-- Parâmetro central: LOYALTY_EVERY_N (equivale a barberShopConfig.loyalty.everyN
-- em src/config/theme.ts e LOYALTY.everyN em functions/utils/site-config.js).
--
-- Semântica CORRECTA:
--   O cliente paga as primeiras (LOYALTY_EVERY_N - 1) reservas do ciclo.
--   Ao concluir a (LOYALTY_EVERY_N - 1)ª reserva, a gratuita fica DISPONÍVEL
--   para ser descontada NA LOYALTY_EVERY_N-ésima reserva.
--
-- Exemplo com LOYALTY_EVERY_N = 10:
--   reservas_concluidas 1–8  → reservas normais, sem gratuita acumulada
--   reservas_concluidas = 9  → reservas_gratuitas_disponiveis += 1  ← disponível!
--   reservas_concluidas = 10 → a 10ª foi grátis; tr_fidelidade_usar desconta -1
--   reservas_concluidas 11–18 → reservas normais
--   reservas_concluidas = 19 → reservas_gratuitas_disponiveis += 1  ← disponível!
--   ...
--
-- Fórmula usada nos triggers: (N + 1) / LOYALTY_EVERY_N
--   N=8:  (8+1)/10 = 0   N=9:  (9+1)/10 = 1  → delta = +1 ✅
--   N=18: (18+1)/10 = 1  N=19: (19+1)/10 = 2  → delta = +1 ✅
--
-- ⚠️  SE ALTERAR LOYALTY_EVERY_N: substituir o valor 10 abaixo em
--     tr_fidelidade_increment e tr_fidelidade_decrement.
--     O resto do código (frontend + site-config.js) usa o valor do config.
-- ────────────────────────────────────────────────────────────────────────────

-- ── reservas_concluidas ─────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS tr_reserva_concluida_increment
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'concluida' AND OLD.status != 'concluida'
BEGIN
  UPDATE clientes
  SET reservas_concluidas = reservas_concluidas + 1,
      last_appointment_date = NEW.data_hora,
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_reserva_concluida_decrement
AFTER UPDATE ON reservas FOR EACH ROW
WHEN OLD.status = 'concluida' AND NEW.status != 'concluida'
BEGIN
  UPDATE clientes
  SET reservas_concluidas = MAX(0, reservas_concluidas - 1),
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

-- ── reservas_gratuitas_disponiveis ───────────────────────────────────────────
--
-- ⚠️  LOYALTY_EVERY_N = 10 (alterar aqui se mudar o config)
--
-- Usa (reservas_concluidas + 1) / LOYALTY_EVERY_N para que a gratuita
-- fique disponível AO CONCLUIR a (N-1)ª reserva, pronta a usar NA Nª.
-- (ao contrário de N/LOYALTY_EVERY_N que só disponibiliza DEPOIS da Nª)

CREATE TRIGGER IF NOT EXISTS tr_fidelidade_increment
AFTER UPDATE ON clientes FOR EACH ROW
WHEN NEW.reservas_concluidas > OLD.reservas_concluidas
BEGIN
  UPDATE clientes
  SET reservas_gratuitas_disponiveis =
    reservas_gratuitas_disponiveis +
    ((NEW.reservas_concluidas + 1) / 10) - ((OLD.reservas_concluidas + 1) / 10)
  WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS tr_fidelidade_decrement
AFTER UPDATE ON clientes FOR EACH ROW
WHEN NEW.reservas_concluidas < OLD.reservas_concluidas
BEGIN
  UPDATE clientes
  SET reservas_gratuitas_disponiveis = MAX(
    0,
    reservas_gratuitas_disponiveis -
      (((OLD.reservas_concluidas + 1) / 10) - ((NEW.reservas_concluidas + 1) / 10))
  )
  WHERE id = NEW.id;
END;

-- ── reserva gratuita usada ───────────────────────────────────────────────────
-- Quando uma reserva é concluída com meio_pagamento = 'oferta',
-- decrementa reservas_gratuitas_disponiveis do cliente (mínimo 0).
CREATE TRIGGER IF NOT EXISTS tr_fidelidade_usar
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'concluida'
  AND NEW.meio_pagamento = 'oferta'
  AND (OLD.meio_pagamento IS NULL OR OLD.meio_pagamento != 'oferta')
BEGIN
  UPDATE clientes
  SET reservas_gratuitas_disponiveis = MAX(0, reservas_gratuitas_disponiveis - 1),
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

-- ── next / last appointment ──────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS tr_reserva_insert_next_appointment
AFTER INSERT ON reservas FOR EACH ROW
WHEN NEW.status = 'confirmada' AND datetime(NEW.data_hora) > datetime('now')
BEGIN
  UPDATE clientes
  SET next_appointment_date = (
    SELECT MIN(data_hora) FROM reservas
    WHERE cliente_id = NEW.cliente_id
      AND status = 'confirmada'
      AND datetime(data_hora) > datetime('now')
  ),
  atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_reserva_cancelada_next_appointment
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'cancelada' AND OLD.status != 'cancelada'
BEGIN
  UPDATE clientes
  SET next_appointment_date = (
    SELECT MIN(data_hora) FROM reservas
    WHERE cliente_id = NEW.cliente_id
      AND status = 'confirmada'
      AND datetime(data_hora) > datetime('now')
      AND id != NEW.id
  ),
  atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

CREATE TRIGGER IF NOT EXISTS tr_reserva_update_datetime
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.data_hora != OLD.data_hora AND NEW.status = 'confirmada'
BEGIN
  UPDATE clientes
  SET next_appointment_date = (
    SELECT MIN(data_hora) FROM reservas
    WHERE cliente_id = NEW.cliente_id
      AND status = 'confirmada'
      AND datetime(data_hora) > datetime('now')
  ),
  atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

-- ── daily_stats ─────────────────────────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS tr_daily_stats_insert
AFTER INSERT ON reservas FOR EACH ROW
BEGIN
  INSERT INTO daily_stats (data, barbeiro_id, confirmadas, concluidas, canceladas, faltas)
  VALUES (
    date(NEW.data_hora),
    NEW.barbeiro_id,
    CASE WHEN NEW.status = 'confirmada' THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'concluida'  THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'cancelada'  THEN 1 ELSE 0 END,
    CASE WHEN NEW.status = 'faltou'     THEN 1 ELSE 0 END
  )
  ON CONFLICT(data, barbeiro_id) DO UPDATE SET
    confirmadas   = confirmadas   + CASE WHEN NEW.status = 'confirmada' THEN 1 ELSE 0 END,
    concluidas    = concluidas    + CASE WHEN NEW.status = 'concluida'  THEN 1 ELSE 0 END,
    canceladas    = canceladas    + CASE WHEN NEW.status = 'cancelada'  THEN 1 ELSE 0 END,
    faltas        = faltas        + CASE WHEN NEW.status = 'faltou'     THEN 1 ELSE 0 END,
    atualizado_em = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS tr_daily_stats_status_update
AFTER UPDATE ON reservas FOR EACH ROW
WHEN OLD.status != NEW.status
BEGIN
  INSERT INTO daily_stats (data, barbeiro_id, confirmadas, concluidas, canceladas, faltas)
  VALUES (date(OLD.data_hora), OLD.barbeiro_id, 0, 0, 0, 0)
  ON CONFLICT(data, barbeiro_id) DO UPDATE SET
    confirmadas   = MAX(0, confirmadas   - CASE WHEN OLD.status = 'confirmada' THEN 1 ELSE 0 END),
    concluidas    = MAX(0, concluidas    - CASE WHEN OLD.status = 'concluida'  THEN 1 ELSE 0 END),
    canceladas    = MAX(0, canceladas    - CASE WHEN OLD.status = 'cancelada'  THEN 1 ELSE 0 END),
    faltas        = MAX(0, faltas        - CASE WHEN OLD.status = 'faltou'     THEN 1 ELSE 0 END),
    atualizado_em = CURRENT_TIMESTAMP;

  INSERT INTO daily_stats (data, barbeiro_id, confirmadas, concluidas, canceladas, faltas)
  VALUES (date(NEW.data_hora), NEW.barbeiro_id, 0, 0, 0, 0)
  ON CONFLICT(data, barbeiro_id) DO UPDATE SET
    confirmadas   = confirmadas   + CASE WHEN NEW.status = 'confirmada' THEN 1 ELSE 0 END,
    concluidas    = concluidas    + CASE WHEN NEW.status = 'concluida'  THEN 1 ELSE 0 END,
    canceladas    = canceladas    + CASE WHEN NEW.status = 'cancelada'  THEN 1 ELSE 0 END,
    faltas        = faltas        + CASE WHEN NEW.status = 'faltou'     THEN 1 ELSE 0 END,
    atualizado_em = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS tr_daily_stats_delete
AFTER DELETE ON reservas FOR EACH ROW
BEGIN
  INSERT INTO daily_stats (data, barbeiro_id, confirmadas, concluidas, canceladas, faltas)
  VALUES (date(OLD.data_hora), OLD.barbeiro_id, 0, 0, 0, 0)
  ON CONFLICT(data, barbeiro_id) DO UPDATE SET
    confirmadas   = MAX(0, confirmadas   - CASE WHEN OLD.status = 'confirmada' THEN 1 ELSE 0 END),
    concluidas    = MAX(0, concluidas    - CASE WHEN OLD.status = 'concluida'  THEN 1 ELSE 0 END),
    canceladas    = MAX(0, canceladas    - CASE WHEN OLD.status = 'cancelada'  THEN 1 ELSE 0 END),
    faltas        = MAX(0, faltas        - CASE WHEN OLD.status = 'faltou'     THEN 1 ELSE 0 END),
    atualizado_em = CURRENT_TIMESTAMP;
END;

-- ================================================
-- MIGRATION (executar em instâncias existentes)
-- ================================================
-- ALTER TABLE clientes ADD COLUMN reservas_gratuitas_disponiveis INTEGER DEFAULT 0;
-- UPDATE clientes SET reservas_gratuitas_disponiveis = MAX(0, (reservas_concluidas + 1) / 10);
-- ALTER TABLE reservas ADD COLUMN comentario_pagamento TEXT DEFAULT NULL;
-- ALTER TABLE reservas ADD COLUMN oferta_valor INTEGER DEFAULT NULL;
-- ALTER TABLE reservas ADD COLUMN oferta_tipo  TEXT    DEFAULT NULL;
-- ================================================
-- VIEWS
-- ================================================
CREATE VIEW IF NOT EXISTS v_reservas_complete AS
SELECT
  r.id, r.cliente_id, r.barbeiro_id, r.servico_id,
  r.data_hora, r.comentario, r.nota_privada, r.status,
  r.created_by, r.duracao_minutos, r.criado_em, r.atualizado_em,
  r.historico_edicoes, r.wpp_lembrete,
  r.moloni_document_id, r.moloni_document_number,
  r.resend_lembrete_id,
  r.meio_pagamento,
  r.valor_pago,
  r.gorjeta,
  r.meio_gorjeta,
  r.comentario_pagamento,
  c.nome     AS cliente_nome,
  c.email    AS cliente_email,
  c.telefone AS cliente_telefone,
  c.nif      AS cliente_nif,
  c.reservas_concluidas AS cliente_total_reservas,
  c.reservas_gratuitas_disponiveis AS cliente_gratuitas_disponiveis,
  r.oferta_valor,
  r.oferta_tipo,
  b.nome  AS barbeiro_nome,
  b.foto  AS barbeiro_foto,
  b.color AS barbeiro_color,
  s.nome       AS servico_nome,
  s.preco      AS servico_preco,
  s.duracao    AS servico_duracao,
  s.abreviacao AS servico_abreviacao,
  s.svg        AS servico_svg,
  s.color      AS servico_color,
  COALESCE(r.duracao_minutos, s.duracao) AS duracao_efetiva
FROM reservas r
JOIN clientes  c ON r.cliente_id  = c.id
JOIN barbeiros b ON r.barbeiro_id = b.id
JOIN servicos  s ON r.servico_id  = s.id;

CREATE VIEW IF NOT EXISTS v_reservas_duracao AS
SELECT
  r.id, r.cliente_id, r.barbeiro_id, r.servico_id,
  r.data_hora, r.status,
  COALESCE(r.duracao_minutos, s.duracao, 60) AS duracao_minutos,
  c.nome AS cliente_nome,
  s.nome AS servico_nome
FROM reservas r
JOIN clientes c ON r.cliente_id = c.id
JOIN servicos s ON r.servico_id = s.id;

CREATE VIEW IF NOT EXISTS v_notifications_recent AS
SELECT
    n.id, n.type, n.message, n.reservation_id,
    n.client_name, n.barber_id, n.is_read, n.created_at,
    b.nome  AS barber_name,
    b.color AS barber_color,
    r.data_hora AS reservation_date
FROM notifications n
         LEFT JOIN barbeiros b ON n.barber_id = b.id
         LEFT JOIN reservas  r ON n.reservation_id = r.id
WHERE datetime(n.created_at) > datetime('now', '-1 day')
ORDER BY n.created_at DESC;

CREATE VIEW IF NOT EXISTS v_notifications_unread AS
SELECT
    n.id, n.type, n.message, n.reservation_id,
    n.client_name, n.barber_id, n.is_read, n.created_at,
    b.nome  AS barber_name,
    b.color AS barber_color,
    r.data_hora AS reservation_date
FROM notifications n
         LEFT JOIN barbeiros b ON n.barber_id = b.id
         LEFT JOIN reservas  r ON n.reservation_id = r.id
WHERE n.is_read = 0
  AND datetime(n.created_at) > datetime('now', '-7 days')
ORDER BY n.created_at DESC;
