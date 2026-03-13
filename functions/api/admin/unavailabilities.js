import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { isValidId, sanitize } from '../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']
const VALID_RECURRENCE = ['none', 'daily', 'weekly']

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    const url      = new URL(request.url)
    const barberId = url.searchParams.get('barber_id')
    const month    = url.searchParams.get('month')

    let where  = []
    let params = []

    if (barberId) { where.push('barbeiro_id = ?'); params.push(barberId) }
    if (month)    { where.push("strftime('%Y-%m', data_hora_inicio) = ?"); params.push(month) }

    const { results } = await env.DB.prepare(`
      SELECT id, barbeiro_id, data_hora_inicio, data_hora_fim,
             is_all_day, tipo, motivo, recurrence_type, recurrence_end_date, recurrence_group_id
      FROM horarios_indisponiveis
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY data_hora_inicio
    `).bind(...params).all()

    return ok(results)
  }

  if (request.method === 'POST') {
    const body = await request.json()
    const { barber_id, start, end, is_all_day, type, reason, recurrence_type, recurrence_end_date } = body

    if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
    if (!start)                return badRequest('Data de início obrigatória')

    const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
    const rec  = recurrence_type && VALID_RECURRENCE.includes(recurrence_type) ? recurrence_type : 'none'

    const r = await env.DB.prepare(`
      INSERT INTO horarios_indisponiveis
        (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo, recurrence_type, recurrence_end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      barber_id, start, end ?? start,
      is_all_day ? 1 : 0,
      tipo, sanitize(reason ?? '', 200),
      rec, recurrence_end_date ?? null
    ).run()

    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
