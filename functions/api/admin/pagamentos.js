import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
    const { request, env } = context
    if (request.method === 'OPTIONS') return corsOptions()

    const auth = await authenticateAdmin(request, env)
    if (!auth.success || auth.user.role !== 'superAdmin') return unauthorized()

    const url      = new URL(request.url)
    const dateFrom = url.searchParams.get('date_from')
    const dateTo   = url.searchParams.get('date_to')

    // Default: mês corrente
    const now   = new Date()
    const from  = dateFrom ?? `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const to    = dateTo   ?? now.toISOString().slice(0, 10)

    try {
        // Totais por meio de pagamento
        const { results: porMeio } = await env.DB.prepare(`
      SELECT
        meio_pagamento,
        COUNT(*)        AS total_reservas,
        SUM(valor_pago) AS total_valor,
        SUM(gorjeta)    AS total_gorjetas
      FROM reservas
      WHERE status = 'concluida'
        AND meio_pagamento IS NOT NULL
        AND date(data_hora) BETWEEN ? AND ?
      GROUP BY meio_pagamento
    `).bind(from, to).all()

        // Totais por barbeiro
        const { results: porBarbeiro } = await env.DB.prepare(`
      SELECT
        b.nome          AS barbeiro_nome,
        b.color         AS barbeiro_color,
        COUNT(r.id)     AS total_reservas,
        SUM(r.valor_pago) AS total_valor,
        SUM(r.gorjeta)    AS total_gorjetas
      FROM reservas r
      JOIN barbeiros b ON r.barbeiro_id = b.id
      WHERE r.status = 'concluida'
        AND r.meio_pagamento IS NOT NULL
        AND date(r.data_hora) BETWEEN ? AND ?
      GROUP BY r.barbeiro_id
      ORDER BY total_valor DESC
    `).bind(from, to).all()

        // Totais por serviço
        const { results: porServico } = await env.DB.prepare(`
      SELECT
        s.nome            AS servico_nome,
        COUNT(r.id)       AS total_reservas,
        SUM(r.valor_pago) AS total_valor,
        AVG(r.valor_pago) AS media_valor
      FROM reservas r
      JOIN servicos s ON r.servico_id = s.id
      WHERE r.status = 'concluida'
        AND r.meio_pagamento IS NOT NULL
        AND date(r.data_hora) BETWEEN ? AND ?
      GROUP BY r.servico_id
      ORDER BY total_valor DESC
    `).bind(from, to).all()

        // Totais gerais
        const totais = await env.DB.prepare(`
      SELECT
        COUNT(*)          AS total_reservas,
        SUM(valor_pago)   AS total_faturado,
        SUM(gorjeta)      AS total_gorjetas,
        AVG(valor_pago)   AS media_por_reserva
      FROM reservas
      WHERE status = 'concluida'
        AND meio_pagamento IS NOT NULL
        AND date(data_hora) BETWEEN ? AND ?
    `).bind(from, to).first()

        // Detalhe linha a linha
        const { results: detalhe } = await env.DB.prepare(`
      SELECT
        r.id,
        r.data_hora,
        c.nome        AS cliente_nome,
        b.nome        AS barbeiro_nome,
        s.nome        AS servico_nome,
        r.valor_pago,
        r.meio_pagamento,
        r.gorjeta,
        r.meio_gorjeta
      FROM reservas r
      JOIN clientes  c ON r.cliente_id  = c.id
      JOIN barbeiros b ON r.barbeiro_id = b.id
      JOIN servicos  s ON r.servico_id  = s.id
      WHERE r.status = 'concluida'
        AND r.meio_pagamento IS NOT NULL
        AND date(r.data_hora) BETWEEN ? AND ?
      ORDER BY r.data_hora DESC
    `).bind(from, to).all()

        return ok({ totais, porMeio, porBarbeiro, porServico, detalhe, periodo: { from, to } })
    } catch (e) {
        return serverError('Erro ao obter pagamentos', e.message)
    }
}