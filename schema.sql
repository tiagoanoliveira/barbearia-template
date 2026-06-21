-- ================================================
-- Compatible: Cloudflare D1 (SQLite dialect)
-- NOTA: PRAGMA journal_mode e foreign_keys não são
-- suportados pelo D1 — omitidos intencionalmente.
-- ================================================
-- Reflecte todas as migrações até 0015 (inclusive):
--   0013_servicos_conta_fidelizacao
--   0014_clientes_bloqueio
--   0015_vendas_produtos
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
  -- DEPRECATED: migrado para tabela descontos (tipo='fidelizacao')
  -- Manter por compatibilidade com triggers existentes até migração completa
  reservas_gratuitas_disponiveis INTEGER DEFAULT 0,
  nif                       INTEGER,
  next_appointment_date     DATETIME,
  last_appointment_date     DATETIME,
  notas                     TEXT,
  foto_perfil               TEXT,
  resend_reset_email_id        TEXT,
  resend_verification_email_id TEXT,
  resend_email_change_id       TEXT,
  -- ── Migração 0014: bloqueio de cliente ──────────────────────────────
  bloqueado                 INTEGER  NOT NULL DEFAULT 0,
  bloqueado_motivo          TEXT     DEFAULT NULL,
  bloqueado_por_admin       INTEGER  REFERENCES admin_users(id) ON DELETE SET NULL,
  bloqueado_em              DATETIME DEFAULT NULL
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
-- índice adicionado na migração 0014
CREATE INDEX        IF NOT EXISTS idx_clientes_bloqueado         ON clientes(bloqueado);

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
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  nome               TEXT    NOT NULL,
  preco              INTEGER NOT NULL DEFAULT 0,
  duracao            INTEGER DEFAULT 60,
  svg                TEXT    NOT NULL DEFAULT 'null',
  abreviacao         TEXT    NOT NULL DEFAULT 'null',
  color              TEXT    NOT NULL DEFAULT '#000000',
  -- Migração 0013: se 1 (default), reservas concluídas com este serviço
  -- incrementam o contador de fidelização do cliente. Se 0, são excluídas.
  conta_fidelizacao  INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE servico_barbeiro (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  servico_id  INTEGER NOT NULL REFERENCES servicos(id)  ON DELETE CASCADE,
  barbeiro_id INTEGER NOT NULL REFERENCES barbeiros(id) ON DELETE CASCADE,
  preco       INTEGER,       -- NULL = usa o preço base do serviço
  duracao     INTEGER,       -- NULL = usa a duração base do serviço
  ativo       INTEGER NOT NULL DEFAULT 1,
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
-- DESCONTOS
-- ================================================
CREATE TABLE IF NOT EXISTS descontos (
  id                        INTEGER  PRIMARY KEY AUTOINCREMENT,
  -- NULL = desconto geral (aplicável a todos os clientes)
  -- NOT NULL = desconto exclusivo de um cliente específico
  cliente_id                INTEGER  REFERENCES clientes(id) ON DELETE CASCADE,
  nome                      TEXT     NOT NULL,
  descricao                 TEXT,
  -- Tipo livre — sem CHECK para permitir adicionar novos tipos apenas no código
  -- Exemplos: 'fidelizacao', 'mensal', 'vitalicio', 'ocasional', 'campanha'
  tipo                      TEXT     NOT NULL,
  -- Origem do desconto (ex: 'manual', 'trigger_fidelizacao', 'campanha')
  origem                    TEXT,
  -- Valor do desconto — pelo menos um dos dois deve ser preenchido
  valor_percentagem         INTEGER  DEFAULT NULL,  -- ex: 10 = 10%
  valor_fixo_centimos       INTEGER  DEFAULT NULL,  -- ex: 500 = 5,00 €
  -- Regras de validade temporal
  valido_de                 DATETIME DEFAULT NULL,
  valido_ate                DATETIME DEFAULT NULL,
  -- Regras de quantidade/período
  min_reservas              INTEGER  DEFAULT NULL,
  min_reservas_periodo      TEXT     DEFAULT NULL,
  -- Agrupamento de descontos escalonados (mesmo grupo = aplica-se o melhor)
  grupo                     TEXT     DEFAULT NULL,
  -- Regras personalizadas (extensível)
  regra_tipo                TEXT     DEFAULT NULL,
  regra_detalhe             TEXT     DEFAULT NULL,
  -- Serviços abrangidos (JSON array de IDs; NULL ou [] = todos os serviços)
  servicos_ids              TEXT     DEFAULT NULL,
  -- Controlo de usos
  -- NULL = ilimitado (vitalício); 1 = ocasional (one-shot)
  max_usos                  INTEGER  DEFAULT NULL,
  usos_feitos               INTEGER  NOT NULL DEFAULT 0,
  -- Tracking do último uso
  usado_ultima_vez_em       DATETIME DEFAULT NULL,
  usado_ultima_reserva_id   INTEGER  REFERENCES reservas(id) ON DELETE SET NULL,
  comentario_uso            TEXT     DEFAULT NULL,
  ativo                     INTEGER  NOT NULL DEFAULT 1,
  -- Auditoria
  criado_por_admin_id       INTEGER  REFERENCES admin_users(id) ON DELETE SET NULL,
  criado_em                 DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em             DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_descontos_cliente_id  ON descontos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_descontos_tipo        ON descontos(tipo);
CREATE INDEX IF NOT EXISTS idx_descontos_ativo       ON descontos(ativo, valido_ate);
CREATE INDEX IF NOT EXISTS idx_descontos_geral_ativo ON descontos(cliente_id, ativo)
  WHERE cliente_id IS NULL;

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

  -- ── Pagamento ───────────────────────────────────────────────────────
  meio_pagamento         TEXT    DEFAULT NULL,
  valor_pago             INTEGER DEFAULT NULL,
  gorjeta                INTEGER DEFAULT NULL,
  meio_gorjeta           TEXT    DEFAULT NULL,
  comentario_pagamento   TEXT    DEFAULT NULL,

  -- ── Oferta / Fidelização ─────────────────────────────────────────
  oferta_valor           INTEGER DEFAULT NULL,
  oferta_tipo            TEXT    DEFAULT NULL,

  -- ── Desconto aplicado (FK para tabela descontos) ────────────────────
  desconto_id            INTEGER DEFAULT NULL REFERENCES descontos(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_reservas_cliente_data          ON reservas(cliente_id, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_barbeiro_data_status  ON reservas(barbeiro_id, data_hora, status);
CREATE INDEX IF NOT EXISTS idx_reservas_created_by            ON reservas(created_by);
CREATE INDEX IF NOT EXISTS idx_reservas_status_data           ON reservas(status, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_disponibilidade       ON reservas(barbeiro_id, data_hora, status);
CREATE INDEX IF NOT EXISTS idx_reservas_cliente_status_data   ON reservas(cliente_id, status, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_moloni_document       ON reservas(moloni_document_id);
CREATE INDEX IF NOT EXISTS idx_reservas_resend_lembrete       ON reservas(resend_lembrete_id);
CREATE INDEX IF NOT EXISTS idx_reservas_meio_pagamento        ON reservas(meio_pagamento, status, data_hora);
CREATE INDEX IF NOT EXISTS idx_reservas_desconto_id           ON reservas(desconto_id);

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
  role          TEXT    NOT NULL DEFAULT 'admin'
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

CREATE TABLE push_subscriptions (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    admin_user_id INTEGER NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    endpoint      TEXT    NOT NULL UNIQUE,
    p256dh        TEXT    NOT NULL,
    auth          TEXT    NOT NULL,
    user_agent    TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

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
-- PRODUTOS E VENDAS (Migração 0015)
-- ================================================

-- Categorias de produtos
CREATE TABLE IF NOT EXISTS produto_categorias (
  id            INTEGER  PRIMARY KEY AUTOINCREMENT,
  nome          TEXT     NOT NULL,
  descricao     TEXT,
  ordem         INTEGER  NOT NULL DEFAULT 0,
  ativo         INTEGER  NOT NULL DEFAULT 1,
  criado_em     DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produto_categorias_ativo ON produto_categorias(ativo);

-- Produtos
CREATE TABLE IF NOT EXISTS produtos (
  id             INTEGER  PRIMARY KEY AUTOINCREMENT,
  categoria_id   INTEGER  NOT NULL REFERENCES produto_categorias(id) ON DELETE RESTRICT,
  nome           TEXT     NOT NULL,
  descricao      TEXT,
  preco_centimos INTEGER  NOT NULL DEFAULT 0,
  ordem          INTEGER  NOT NULL DEFAULT 0,
  ativo          INTEGER  NOT NULL DEFAULT 1,
  criado_em      DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em  DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produtos_categoria_id ON produtos(categoria_id);
CREATE INDEX IF NOT EXISTS idx_produtos_ativo        ON produtos(ativo);

-- Cabeçalho de vendas de produtos
CREATE TABLE IF NOT EXISTS produto_vendas (
  id             INTEGER  PRIMARY KEY AUTOINCREMENT,
  admin_user_id  INTEGER  NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
  cliente_id     INTEGER  REFERENCES clientes(id) ON DELETE SET NULL,
  total_centimos INTEGER  NOT NULL DEFAULT 0,
  meio_pagamento TEXT     NOT NULL,
  notas          TEXT,
  criado_em      DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_produto_vendas_admin_user_id ON produto_vendas(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_produto_vendas_cliente_id   ON produto_vendas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_produto_vendas_criado_em    ON produto_vendas(criado_em);

-- Linhas de cada venda
CREATE TABLE IF NOT EXISTS produto_venda_itens (
  id                      INTEGER  PRIMARY KEY AUTOINCREMENT,
  venda_id                INTEGER  NOT NULL REFERENCES produto_vendas(id) ON DELETE CASCADE,
  produto_id              INTEGER  NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade              INTEGER  NOT NULL DEFAULT 1,
  preco_unitario_centimos INTEGER  NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_produto_venda_itens_venda_id   ON produto_venda_itens(venda_id);
CREATE INDEX IF NOT EXISTS idx_produto_venda_itens_produto_id ON produto_venda_itens(produto_id);

-- ================================================
-- TRIGGERS
-- ================================================

-- ──────────────────────────────────────────────────────────────────────
-- SISTEMA DE FIDELIZAÇÃO
--
-- Mantém os triggers originais para compatibilidade com
-- reservas_gratuitas_disponiveis durante período de transição.
-- O novo sistema de descontos (tabela descontos) convive em paralelo.
-- ──────────────────────────────────────────────────────────────────────

-- ── reservas_concluidas ────────────────────────────────────────────────
-- Atualizado na migração 0013: só incrementa se conta_fidelizacao = 1.
-- last_appointment_date é sempre atualizado, independentemente do serviço.
CREATE TRIGGER IF NOT EXISTS tr_reserva_concluida_increment
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'concluida' AND OLD.status != 'concluida'
BEGIN
  UPDATE clientes
  SET reservas_concluidas = reservas_concluidas + 1,
      last_appointment_date = NEW.data_hora,
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id
    AND (SELECT conta_fidelizacao FROM servicos WHERE id = NEW.servico_id) = 1;

  -- Atualizar last_appointment_date mesmo que o serviço não conte para fidelização
  UPDATE clientes
  SET last_appointment_date = NEW.data_hora,
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id
    AND (SELECT conta_fidelizacao FROM servicos WHERE id = NEW.servico_id) != 1;
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

-- ── reservas_gratuitas_disponiveis (compat. legado) ─────────────────────
--
-- ⚠️  LOYALTY_EVERY_N = 10 (alterar aqui se mudar o config)

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

-- ── reserva gratuita usada (compat. legado) ────────────────────────────
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

-- ── next / last appointment ──────────────────────────────────────────
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

-- ── daily_stats ────────────────────────────────────────────────────────────
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
  r.oferta_valor,
  r.oferta_tipo,
  r.desconto_id,
  c.nome     AS cliente_nome,
  c.email    AS cliente_email,
  c.telefone AS cliente_telefone,
  c.nif      AS cliente_nif,
  c.reservas_concluidas AS cliente_total_reservas,
  c.reservas_gratuitas_disponiveis AS cliente_gratuitas_disponiveis,
  b.nome  AS barbeiro_nome,
  b.foto  AS barbeiro_foto,
  b.color AS barbeiro_color,
  s.nome              AS servico_nome,
  s.preco             AS servico_preco,
  s.duracao           AS servico_duracao,
  s.abreviacao        AS servico_abreviacao,
  s.svg               AS servico_svg,
  s.color             AS servico_color,
  s.conta_fidelizacao AS servico_conta_fidelizacao,
  COALESCE(r.duracao_minutos, s.duracao) AS duracao_efetiva,
  d.nome              AS desconto_nome,
  d.tipo              AS desconto_tipo,
  d.valor_percentagem AS desconto_percentagem,
  d.valor_fixo_centimos AS desconto_fixo_centimos
FROM reservas r
JOIN clientes  c ON r.cliente_id  = c.id
JOIN barbeiros b ON r.barbeiro_id = b.id
JOIN servicos  s ON r.servico_id  = s.id
LEFT JOIN descontos d ON r.desconto_id = d.id;

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

-- View de vendas completas (Migração 0015)
DROP VIEW IF EXISTS v_produto_vendas_complete;
CREATE VIEW IF NOT EXISTS v_produto_vendas_complete AS
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
