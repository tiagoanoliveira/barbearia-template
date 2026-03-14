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
    try {
      const url      = new URL(request.url)
      const barberId = url.searchParams.get('barber_id')
      const month    = url.searchParams.get('month')
      const date     = url.searchParams.get('date')

      const where  = []
      const params = []

      if (barberId) { where.push('h.barbeiro_id = ?'); params.push(barberId) }
      if (month)    { where.push("strftime('%Y-%m', h.data_hora_inicio) = ?"); params.push(month) }
      if (date)     { where.push('date(h.data_hora_inicio) <= ? AND date(h.data_hora_fim) >= ?'); params.push(date, date) }

      const { results } = await env.DB.prepare(`
        SELECT
          h.id,
          h.barbeiro_id,
          b.nome AS barbeiro_nome,
          b.color AS barbeiro_color,
          h.data_hora_inicio,
          h.data_hora_fim,
          h.is_all_day,
          h.tipo,
          h.motivo,
          h.recurrence_type,
          h.recurrence_end_date,
          h.recurrence_group_id
        FROM horarios_indisponiveis h
        JOIN barbeiros b ON h.barbeiro_id = b.id
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ORDER BY h.data_hora_inicio
      `).bind(...params).all()

      return ok(results)
    } catch (e) {
      return serverError('Erro ao listar indisponibilidades', e.message)
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { barber_id, start, end, is_all_day, type, reason, recurrence_type, recurrence_end_date } = body

      if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
      if (!start)                return badRequest('Data de início obrigatória')

      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
      const rec  = recurrence_type && VALID_RECURRENCE.includes(recurrence_type) ? recurrence_type : 'none'

      // Para recorrências, gerar um group_id e criar múltiplos registos
      if (rec !== 'none' && recurrence_end_date) {
        const groupId    = `grp_${Date.now()}_${barber_id}`
        const startDate  = new Date(start)
        const endDate    = new Date(end ?? start)
        const stopDate   = new Date(recurrence_end_date)
        const diffMs     = endDate.getTime() - startDate.getTime()

        const inserts = []
        let cursor    = new Date(startDate)

        while (cursor <= stopDate) {
          const recStart = cursor.toISOString().replace('Z', '').split('.')[0]
          const recEnd   = new Date(cursor.getTime() + diffMs).toISOString().replace('Z', '').split('.')[0]
          inserts.push({ start: recStart, end: recEnd })

          if (rec === 'daily')  cursor.setDate(cursor.getDate() + 1)
          else if (rec === 'weekly') cursor.setDate(cursor.getDate() + 7)
          else break

          if (inserts.length > 365) break // safety
        }

        const stmt = env.DB.prepare(`
          INSERT INTO horarios_indisponiveis
            (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo,
             recurrence_type, recurrence_end_date, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )

        await env.DB.batch(
          inserts.map(({ start: s, end: e }) =>
            stmt.bind(
              barber_id, s, e,
              is_all_day ? 1 : 0,
              tipo, sanitize(reason ?? '', 200),
              rec, recurrence_end_date, groupId
            )
          )
        )

        return created({ groupId, count: inserts.length })
      }

      // Registo singular
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
    } catch (e) {
      return serverError('Erro ao criar indisponibilidade', e.message)
    }
  }

  return badRequest('Método não suportado')
}
