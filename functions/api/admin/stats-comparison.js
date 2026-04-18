import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  try {
    const url = new URL(request.url)
    const periodA_start = url.searchParams.get('periodA_start')
    const periodA_end   = url.searchParams.get('periodA_end')
    const periodB_start = url.searchParams.get('periodB_start')
    const periodB_end   = url.searchParams.get('periodB_end')
    const queryBarberId = url.searchParams.get('barbeiro_id')
    const effectiveBarberId = auth.user.role === 'barbeiro'
      ? auth.user.barbeiro_id
      : (queryBarberId ? Number(queryBarberId) : null)

    if (!periodA_start || !periodA_end || !periodB_start || !periodB_end) {
      return ok([])
    }

    const hasBarber = !!effectiveBarberId
    const barberFilter = hasBarber ? 'AND ds.barbeiro_id = ?' : ''

    const params = hasBarber
      ? [periodA_start, periodA_end, Number(effectiveBarberId), periodB_start, periodB_end, Number(effectiveBarberId)]
      : [periodA_start, periodA_end, periodB_start, periodB_end]

    const query = `
      SELECT
        'A' AS periodo,
        data,
        SUM(confirmadas) AS confirmadas,
        SUM(concluidas)  AS concluidas,
        SUM(canceladas)  AS canceladas,
        SUM(faltas)      AS faltas
      FROM daily_stats ds
      JOIN barbeiros b ON b.id = ds.barbeiro_id
      WHERE b.ativo = 1
        AND data BETWEEN ? AND ? ${barberFilter}
      GROUP BY data
      UNION ALL
      SELECT
        'B' AS periodo,
        data,
        SUM(confirmadas),
        SUM(concluidas),
        SUM(canceladas),
        SUM(faltas)
      FROM daily_stats ds
      JOIN barbeiros b ON b.id = ds.barbeiro_id
      WHERE b.ativo = 1
        AND data BETWEEN ? AND ? ${barberFilter}
      GROUP BY data
      ORDER BY periodo, data
    `

    const { results } = await env.DB.prepare(query).bind(...params).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar estatísticas de comparação', e.message)
  }
}
