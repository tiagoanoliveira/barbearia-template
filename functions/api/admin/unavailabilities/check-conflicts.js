import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../../utils/response.js'
import { isValidId } from '../../../utils/validators.js'

function buildConflictPeriods({ start, end, isAllDay, recurrenceType, recurrenceEndDate }) {
  const toEffective = (s, e) => {
    if (isAllDay) {
      return {
        start: String(s).substring(0, 10) + 'T00:00:00',
        end:   String(e ?? s).substring(0, 10) + 'T23:59:59',
      }
    }
    return {
      start: String(s).replace('Z', '').split('.')[0],
      end:   String(e ?? s).replace('Z', '').split('.')[0],
    }
  }

  if (recurrenceType !== 'none' && recurrenceEndDate) {
    const startDate = new Date(start)
    const endDate   = new Date(end ?? start)
    const stopDate  = new Date(recurrenceEndDate + 'T23:59:59')
    const diffMs    = endDate.getTime() - startDate.getTime()
    const periods   = []
    let cursor      = new Date(startDate)

    while (cursor <= stopDate && periods.length < 365) {
      const recEnd = new Date(cursor.getTime() + diffMs)
      periods.push(toEffective(cursor.toISOString(), recEnd.toISOString()))
      if (recurrenceType === 'daily')       cursor.setDate(cursor.getDate() + 1)
      else if (recurrenceType === 'weekly') cursor.setDate(cursor.getDate() + 7)
      else break
    }
    return periods
  }

  return [toEffective(start, end)]
}

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não suportado')

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  try {
    const body = await request.json()
    const { barber_id, start, end, is_all_day, recurrence_type, recurrence_end_date } = body

    if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
    if (!start)                return badRequest('Data de início obrigatória')

    const periods = buildConflictPeriods({
      start,
      end,
      isAllDay:          !!is_all_day,
      recurrenceType:    recurrence_type ?? 'none',
      recurrenceEndDate: recurrence_end_date,
    })

    if (!periods.length) return ok([])

    const minDate = periods.reduce((m, p) => p.start < m ? p.start : m, periods[0].start).substring(0, 10)
    const maxDate = periods.reduce((m, p) => p.end   > m ? p.end   : m, periods[0].end  ).substring(0, 10)

    const { results } = await env.DB.prepare(`
      SELECT
        r.id,
        r.data_hora,
        r.cliente_nome AS client_name,
        r.servico_nome AS service_name,
        r.duracao_minutos
      FROM v_reservas_duracao r
      WHERE r.barbeiro_id = ?
        AND r.status = 'confirmada'
        AND date(r.data_hora) >= ?
        AND date(r.data_hora) <= ?
      ORDER BY r.data_hora ASC
    `).bind(barber_id, minDate, maxDate).all()

    const conflicting = results.filter(r => {
      const rStart = new Date(r.data_hora)
      const rEnd   = new Date(rStart.getTime() + (r.duracao_minutos ?? 60) * 60000)
      return periods.some(p => {
        const pStart = new Date(p.start)
        const pEnd   = new Date(p.end)
        return rStart < pEnd && rEnd > pStart
      })
    })

    return ok(conflicting)
  } catch (e) {
    return serverError('Erro ao verificar conflitos', e.message)
  }
}
