-- =====================================================
-- REBUILD daily_stats
-- Reconstrói toda a tabela a partir das reservas reais.
-- Seguro de correr a qualquer altura.
-- =====================================================

-- 1. Limpar todos os dados existentes
DELETE FROM daily_stats;

-- 2. Reconstruir a partir das reservas actuais
INSERT INTO daily_stats (data, barbeiro_id, confirmadas, concluidas, canceladas, faltas, atualizado_em)
SELECT
    date(data_hora)                                  AS data,
    barbeiro_id,
    SUM(CASE WHEN status = 'confirmada' THEN 1 ELSE 0 END) AS confirmadas,
    SUM(CASE WHEN status = 'concluida'  THEN 1 ELSE 0 END) AS concluidas,
    SUM(CASE WHEN status = 'cancelada'  THEN 1 ELSE 0 END) AS canceladas,
    SUM(CASE WHEN status = 'faltou'     THEN 1 ELSE 0 END) AS faltas,
    CURRENT_TIMESTAMP
FROM reservas
GROUP BY date(data_hora), barbeiro_id;

-- =====================================================
-- REBUILD reservas_concluidas e gratuitas_disponiveis
-- =====================================================

-- 1. Recalcular reservas_concluidas de cada cliente
UPDATE clientes
SET reservas_concluidas = (
    SELECT COUNT(*)
    FROM reservas
    WHERE cliente_id = clientes.id
      AND status = 'concluida'
);

-- 2. Recalcular reservas gratuitas disponíveis (fidelização a cada 10)
-- ⚠️  Não reconstrói "gratuitas já usadas" — apenas as disponíveis com
--     base no contador actual de concluidas.
UPDATE clientes
SET reservas_gratuitas_disponiveis = MAX(
        0,
        ((reservas_concluidas + 1) / 10) - (
            -- Quantas gratuitas já foram usadas (reservas com oferta_tipo = 'fidelidade')
            SELECT COUNT(*)
            FROM reservas
            WHERE cliente_id = clientes.id
              AND status = 'concluida'
              AND oferta_tipo = 'fidelidade'
        )
                                     );