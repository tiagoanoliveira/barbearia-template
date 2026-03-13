import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, notFound, serverError, corsOptions } from '../../utils/response.js'
import { isValidId, sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    const url        = new URL(request.url)
    const barberId   = url.searchParams.get('barber_id')
    const month      = url.searchParams.get('month') // YYYY-MM

    let where  = []
    let params = []

    if (barberId) { where.push('barbeiro_id = ?'); params.push(barberId) }
    if (month)    { where.push("strftime('%Y-%m', data_hora_inicio) = ?"); params.push(month) }

    const { results } = await env.DB.prepare(`
      SELECT id, barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo
      FROM horarios_indisponiveis
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY data_hora_inicio
    `).bind(...params).all()

    return ok(results)
  }

  if (request.method === 'POST') {
    const body = await request.json()
    const { barber_id, start, end, is_all_day, type, reason } = body

    if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
    if (!start)                return badRequest('Data de início obrigatória')

    const r = await env.DB.prepare(`
      INSERT INTO horarios_indisponiveis
        (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      barber_id,
      start,
      end ?? start,
      is_all_day ? 1 : 0,
      sanitize(type ?? 'folga', 50),
      sanitize(reason ?? '', 200)
    ).run()

    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
