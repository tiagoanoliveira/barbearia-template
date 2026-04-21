import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { isValidId, sanitize } from '../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']
const VALID_RECURRENCE = ['none', 'daily', 'weekly']

function normalizeOccurrence(start, end) {
  return {
    start: String(start).replace('Z', '').split('.')[0],
    end:   String(end).replace('Z', '').split('.')[0],
  }
}

function buildOccurrences({ start, end, recurrenceType, recurrenceEndDate }) {
  if (recurrenceType !== 'none' && recurrenceEndDate) {
    const startDate = new Date(start)
    const endDate   = new Date(end ?? start)
    const stopDate  = new Date(recurrenceEndDate)
    const diffMs    = endDate.getTime() - startDate.getTime()
    const inserts   = []
    let cursor      = new Date(startDate)

    while (cursor <= stopDate) {
      const recStart = new Date(cursor)
      const recEnd   = new Date(cursor.getTime() + diffMs)
      inserts.push(normalizeOccurrence(recStart.toISOString(), recEnd.toISOString()))
      if (recurrenceType === 'daily')       cursor.setDate(cursor.getDate() + 1)
      else if (recurrenceType === 'weekly') cursor.setDate(cursor.getDate() + 7)
      else break
      if (inserts.length > 365) break
    }
    return inserts
  }

  return [normalizeOccurrence(start, end ?? start)]
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const user = auth.user

  if (request.method === 'GET') {
    try {
      const url      = new URL(request.url)
      const barberId = url.searchParams.get('barber_id')
      const month    = url.searchParams.get('month')
      const date     = url.searchParams.get('date')

      const where  = []
      const params = []
      where.push('b.ativo = 1')

      if (barberId) {
        where.push('h.barbeiro_id = ?')
        params.push(barberId)
      }

      if (user.role === 'barbeiro' && user.barbeiro_id) {
        where.push('h.barbeiro_id = ?')
        params.push(user.barbeiro_id)
      }

      if (month) {
        where.push("strftime('%Y-%m', h.data_hora_inicio) = ?")
        params.push(month)
      }
      if (date) {
        where.push('date(h.data_hora_inicio) <= ? AND date(h.data_hora_fim) >= ?')
        params.push(date, date)
      }

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
      const {
        barber_id,
        start,
        end,
        is_all_day,
        type,
        reason,
        recurrence_type,
        recurrence_end_date,
      } = body

      if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
      if (!start)                return badRequest('Data de início obrigatória')

      if (user.role === 'barbeiro' && user.barbeiro_id && Number(user.barbeiro_id) !== Number(barber_id)) {
        return unauthorized()
      }

      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
      const rec  = recurrence_type && VALID_RECURRENCE.includes(recurrence_type) ? recurrence_type : 'none'

      const barber = await env.DB.prepare('SELECT id, ativo FROM barbeiros WHERE id = ?').bind(barber_id).first()
      if (!barber || Number(barber.ativo) !== 1) return badRequest('Barbeiro inválido ou inativo')

      const occurrences = buildOccurrences({
        start,
        end,
        recurrenceType: rec,
        recurrenceEndDate: recurrence_end_date,
      })
      if (!occurrences.length) return badRequest('Período inválido')

      if (rec !== 'none' && recurrence_end_date) {
        const groupId = `grp_${Date.now()}_${barber_id}`
        const stmt = env.DB.prepare(`
          INSERT INTO horarios_indisponiveis
            (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo,
             recurrence_type, recurrence_end_date, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        await env.DB.batch(
          occurrences.map(({ start: s, end: e }) =>
            stmt.bind(barber_id, s, e, is_all_day ? 1 : 0, tipo, sanitize(reason ?? '', 200), rec, recurrence_end_date, groupId)
          )
        )
        return created({ groupId, count: occurrences.length })
      }

      const r = await env.DB.prepare(`
        INSERT INTO horarios_indisponiveis
          (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo, recurrence_type, recurrence_end_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        barber_id, start, end ?? start,
        is_all_day ? 1 : 0,
        tipo, sanitize(reason ?? '', 200),
        rec, recurrence_end_date ?? null,
      ).run()

      return created({ id: r.meta.last_row_id })
    } catch (e) {
      return serverError('Erro ao criar indisponibilidade', e.message)
    }
  }

  return badRequest('Método não suportado')
}
