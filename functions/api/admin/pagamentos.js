import { authenticateAdmin } from '../../utils/auth.js'
import { isSuperAdmin } from '../../utils/authz.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (!isSuperAdmin(auth)) {
    console.warn('admin/pagamentos: acesso negado', { role: auth.user?.role })
    return unauthorized('Apenas superAdmin pode aceder a pagamentos')
  }

  const url      = new URL(request.url)
  const dateFrom = url.searchParams.get('date_from')
  const dateTo   = url.searchParams.get('date_to')

  const now  = new Date()
  const from = dateFrom ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const to   = dateTo   ?? now.toISOString().slice(0, 10)

  // valor_faturado = o que o cliente pagou + o valor da oferta (= preço real do serviço)
  // total_recebido = dinheiro efectivamente entrado no caixa
  // total_ofertas  = montante abonado pela barbearia
  try {
    const { results: porMeio } = await env.DB.prepare(`
      SELECT
        COALESCE(meio_pagamento, 'Oferta') AS meio_pagamento,
        COUNT(*)                           AS total_reservas,
        SUM(COALESCE(valor_pago, 0) + COALESCE(oferta_valor, 0)) AS total_valor,
        SUM(gorjeta)                       AS total_gorjetas
      FROM reservas
      WHERE status = 'concluida'
        AND (meio_pagamento IS NOT NULL OR oferta_valor IS NOT NULL)
        AND date(data_hora) BETWEEN ? AND ?
      GROUP BY COALESCE(meio_pagamento, 'Oferta')
    `).bind(from, to).all()

    const { results: porBarbeiro } = await env.DB.prepare(`
      SELECT
        b.nome                                              AS barbeiro_nome,
        b.color                                             AS barbeiro_color,
        COUNT(r.id)                                         AS total_reservas,
        SUM(COALESCE(r.valor_pago, 0) + COALESCE(r.oferta_valor, 0)) AS total_valor,
        SUM(COALESCE(r.valor_pago, 0))                      AS total_recebido,
        SUM(COALESCE(r.oferta_valor, 0))                    AS total_ofertas,
        SUM(r.gorjeta)                                      AS total_gorjetas,
        SUM(CASE WHEN r.meio_pagamento = 'dinheiro'    THEN COALESCE(r.valor_pago, 0) ELSE 0 END) AS total_dinheiro,
        SUM(CASE WHEN r.meio_pagamento = 'multibanco'  THEN COALESCE(r.valor_pago, 0) ELSE 0 END) AS total_multibanco,
        SUM(CASE WHEN r.meio_pagamento NOT IN ('dinheiro','multibanco') AND r.meio_pagamento IS NOT NULL
         THEN COALESCE(r.valor_pago, 0) ELSE 0 END)                                       AS total_outro
      FROM reservas r
      JOIN barbeiros b ON r.barbeiro_id = b.id
      WHERE r.status = 'concluida'
        AND (r.meio_pagamento IS NOT NULL OR r.oferta_valor IS NOT NULL)
        AND date(r.data_hora) BETWEEN ? AND ?
      GROUP BY r.barbeiro_id
      ORDER BY total_valor DESC
    `).bind(from, to).all()

    const { results: porServico } = await env.DB.prepare(`
      SELECT
        s.nome            AS servico_nome,
        COUNT(r.id)       AS total_reservas,
        SUM(COALESCE(r.valor_pago, 0) + COALESCE(r.oferta_valor, 0)) AS total_valor,
        AVG(COALESCE(r.valor_pago, 0) + COALESCE(r.oferta_valor, 0)) AS media_valor
      FROM reservas r
      JOIN servicos s ON r.servico_id = s.id
      WHERE r.status = 'concluida'
        AND (r.meio_pagamento IS NOT NULL OR r.oferta_valor IS NOT NULL)
        AND date(r.data_hora) BETWEEN ? AND ?
      GROUP BY r.servico_id
      ORDER BY total_valor DESC
    `).bind(from, to).all()

    const totais = await env.DB.prepare(`
      SELECT
        COUNT(*)                                                         AS total_reservas,
        SUM(COALESCE(valor_pago, 0) + COALESCE(oferta_valor, 0))        AS total_faturado,
        SUM(COALESCE(valor_pago, 0))                                     AS total_recebido,
        SUM(COALESCE(oferta_valor, 0))                                   AS total_ofertas,
        SUM(gorjeta)                                                     AS total_gorjetas,
        AVG(COALESCE(valor_pago, 0) + COALESCE(oferta_valor, 0))        AS media_por_reserva
      FROM reservas
      WHERE status = 'concluida'
        AND (meio_pagamento IS NOT NULL OR oferta_valor IS NOT NULL)
        AND date(data_hora) BETWEEN ? AND ?
    `).bind(from, to).first()

    const { results: detalhe } = await env.DB.prepare(`
      SELECT
        r.id,
        r.data_hora,
        c.nome                                                          AS cliente_nome,
        b.nome                                                          AS barbeiro_nome,
        s.nome                                                          AS servico_nome,
        r.valor_pago,
        r.oferta_valor,
        r.oferta_tipo,
        COALESCE(r.valor_pago, 0) + COALESCE(r.oferta_valor, 0)        AS valor_faturado,
        r.meio_pagamento,
        r.gorjeta,
        r.meio_gorjeta,
        r.comentario_pagamento
      FROM reservas r
      JOIN clientes  c ON r.cliente_id  = c.id
      JOIN barbeiros b ON r.barbeiro_id = b.id
      JOIN servicos  s ON r.servico_id  = s.id
      WHERE r.status = 'concluida'
        AND (r.meio_pagamento IS NOT NULL OR r.oferta_valor IS NOT NULL)
        AND date(r.data_hora) BETWEEN ? AND ?
      ORDER BY r.data_hora DESC
    `).bind(from, to).all()

    return ok({ totais, porMeio, porBarbeiro, porServico, detalhe, periodo: { from, to } })
  } catch (e) {
    return serverError('Erro ao obter pagamentos', e.message)
  }
}
