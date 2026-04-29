-- ============================================================
-- Migration: suporte a ofertas parciais
-- Aplicar manualmente na Cloudflare D1 com:
--   wrangler d1 execute <DB_NAME> --file=db/migration-ofertas.sql
-- ============================================================

-- 1. Novos campos na tabela reservas
--    oferta_valor : valor abonado pela barbearia, em cêntimos (null = sem oferta)
--    oferta_tipo  : identificador livre do tipo de oferta ('fidelidade', 'cortesia', etc.)
ALTER TABLE reservas ADD COLUMN oferta_valor INTEGER DEFAULT NULL;
ALTER TABLE reservas ADD COLUMN oferta_tipo  TEXT    DEFAULT NULL;

-- 2. Substituir o trigger tr_fidelidade_usar
--    Antes: disparava quando meio_pagamento = 'oferta'
--    Agora: dispara quando oferta_tipo = 'fidelidade' ao concluir
DROP TRIGGER IF EXISTS tr_fidelidade_usar;

CREATE TRIGGER tr_fidelidade_usar
AFTER UPDATE ON reservas FOR EACH ROW
WHEN NEW.status = 'concluida'
  AND NEW.oferta_tipo = 'fidelidade'
  AND (OLD.oferta_tipo IS NULL OR OLD.oferta_tipo != 'fidelidade')
BEGIN
  UPDATE clientes
  SET reservas_gratuitas_disponiveis = MAX(0, reservas_gratuitas_disponiveis - 1),
      atualizado_em = CURRENT_TIMESTAMP
  WHERE id = NEW.cliente_id;
END;

-- ============================================================
-- Nota: registos históricos com meio_pagamento = 'oferta'
-- NÃO são alterados. O valor faturado nesses registos
-- continua a calcular-se como:
--   COALESCE(valor_pago, 0) + COALESCE(oferta_valor, 0)
-- que para registos antigos dá 0 + 0 = 0 (comportamento mantido).
-- Se no futuro quiser retroactivamente corrigir esses registos,
-- execute o seguinte (OPCIONAL, não corre por defeito):
--
-- UPDATE reservas
-- SET oferta_tipo  = 'fidelidade',
--     oferta_valor = (SELECT preco FROM servicos WHERE id = reservas.servico_id),
--     valor_pago   = 0
-- WHERE meio_pagamento = 'oferta';
-- ============================================================
