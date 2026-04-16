import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  try {
    const today = new Date().toISOString().slice(0, 10)
    const url = new URL(request.url)
    const requestedBarberId = url.searchParams.get('barbeiro_id')
    const targetBarberId = auth.user.role === 'barbeiro'
      ? auth.user.barbeiro_id
      : (requestedBarberId ? Number(requestedBarberId) : null)

    const whereBarber = targetBarberId ? 'AND b.id = ?' : ''

    const stmt = env.DB.prepare(`
      SELECT
        ds.barbeiro_id,
        b.nome  AS barbeiro_nome,
        b.color AS barbeiro_color,
        COALESCE(ds.confirmadas, 0) AS confirmadas,
        COALESCE(ds.concluidas,  0) AS concluidas,
        COALESCE(ds.canceladas,  0) AS canceladas,
        COALESCE(ds.faltas,      0) AS faltas
      FROM barbeiros b
      LEFT JOIN daily_stats ds
        ON ds.barbeiro_id = b.id AND ds.data = ?
      WHERE b.ativo = 1
        ${whereBarber}
      ORDER BY b.nome
    `)

    const { results } = targetBarberId
      ? await stmt.bind(today, targetBarberId).all()
      : await stmt.bind(today).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar estatísticas de hoje por barbeiro', e.message)
  }
}
