-- ================================================
-- MIGRATION 0011 — Sistema de Descontos
-- Executar em instâncias existentes (D1 wrangler d1 execute)
-- ================================================

-- 1. Tabela descontos ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS descontos (
  id                      INTEGER  PRIMARY KEY AUTOINCREMENT,
  cliente_id              INTEGER  REFERENCES clientes(id) ON DELETE CASCADE,
  nome                    TEXT     NOT NULL,
  descricao               TEXT,
  tipo                    TEXT     NOT NULL,
  origem                  TEXT,
  valor_percentagem       INTEGER  DEFAULT NULL,
  valor_fixo_centimos     INTEGER  DEFAULT NULL,
  valido_de               DATETIME DEFAULT NULL,
  valido_ate              DATETIME DEFAULT NULL,
  min_reservas            INTEGER  DEFAULT NULL,
  min_reservas_periodo    TEXT     DEFAULT NULL,
  grupo                   TEXT DEFAULT NULL,
  regra_tipo              TEXT DEFAULT NULL,
  regra_detalhe           TEXT DEFAULT NULL,
    servicos_ids TEXT DEFAULT NULL,
  max_usos                INTEGER  DEFAULT NULL,
  usos_feitos             INTEGER  NOT NULL DEFAULT 0,
  usado_ultima_vez_em     DATETIME DEFAULT NULL,
  usado_ultima_reserva_id INTEGER  REFERENCES reservas(id) ON DELETE SET NULL,
  comentario_uso          TEXT     DEFAULT NULL,
  ativo                   INTEGER  NOT NULL DEFAULT 1,
  criado_por_admin_id     INTEGER  REFERENCES admin_users(id) ON DELETE SET NULL,
  criado_em               DATETIME NOT NULL DEFAULT (datetime('now')),
  atualizado_em           DATETIME NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_descontos_cliente_id  ON descontos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_descontos_tipo        ON descontos(tipo);
CREATE INDEX IF NOT EXISTS idx_descontos_ativo       ON descontos(ativo, valido_ate);
CREATE INDEX IF NOT EXISTS idx_descontos_geral_ativo ON descontos(cliente_id, ativo)
  WHERE cliente_id IS NULL;

-- 2. Coluna desconto_id em reservas ─────────────────────────────────────────
ALTER TABLE reservas ADD COLUMN desconto_id INTEGER DEFAULT NULL REFERENCES descontos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_reservas_desconto_id ON reservas(desconto_id);

-- 3. Marcar reservas_gratuitas_disponiveis como deprecated ─────────────────
-- Nada a alterar na coluna — já existe. Apenas registar aqui que
-- a coluna fica congelada e não deve ser incrementada por novo código.
-- Os triggers tr_fidelidade_* mantêm-se ativos por compatibilidade.

-- 4. Atualizar a view v_reservas_complete para incluir desconto_id e JOIN ──
DROP VIEW IF EXISTS v_reservas_complete;
CREATE VIEW v_reservas_complete AS
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
  s.nome       AS servico_nome,
  s.preco      AS servico_preco,
  s.duracao    AS servico_duracao,
  s.abreviacao AS servico_abreviacao,
  s.svg        AS servico_svg,
  s.color      AS servico_color,
  COALESCE(r.duracao_minutos, s.duracao) AS duracao_efetiva,
  d.nome                AS desconto_nome,
  d.tipo                AS desconto_tipo,
  d.valor_percentagem   AS desconto_percentagem,
  d.valor_fixo_centimos AS desconto_fixo_centimos
FROM reservas r
JOIN clientes  c ON r.cliente_id  = c.id
JOIN barbeiros b ON r.barbeiro_id = b.id
JOIN servicos  s ON r.servico_id  = s.id
LEFT JOIN descontos d ON r.desconto_id = d.id;
