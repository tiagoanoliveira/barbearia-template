import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions, jsonResponse } from '../../utils/response.js'
import { isValidId, sanitize } from '../../utils/validators.js'
import { sendReservationCancellation } from '../../utils/reservationEmails.js'

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

async function findConflictingReservations(env, barberId, occurrences) {
  if (!occurrences.length) return []

  const overlapClauses = []
  const params = [barberId]
  for (const occurrence of occurrences) {
    overlapClauses.push(
      `(datetime(r.data_hora) < datetime(?) AND datetime(r.data_hora, '+' || COALESCE(r.duracao_minutos, s.duracao, 60) || ' minutes') > datetime(?))`
    )
    params.push(occurrence.end, occurrence.start)
  }

  const { results } = await env.DB.prepare(
    `SELECT
      r.id,
      r.data_hora,
      COALESCE(r.duracao_minutos, s.duracao, 60) AS duration_minutes,
      c.nome AS client_name,
      c.email AS client_email,
      s.nome AS service_name,
      b.nome AS barber_name,
      r.resend_lembrete_id
     FROM reservas r
     JOIN clientes c ON c.id = r.cliente_id
     JOIN servicos s ON s.id = r.servico_id
     JOIN barbeiros b ON b.id = r.barbeiro_id
     WHERE r.barbeiro_id = ?
       AND r.status = 'confirmada'
       AND (${overlapClauses.join(' OR ')})
     ORDER BY r.data_hora ASC`
  ).bind(...params).all()

  return results ?? []
}

async function cancelSelectedReservations(context, reservations, cancelReason) {
  if (!reservations.length) return 0

  const reason = sanitize(cancelReason ?? '', 1000)
  const privateNote = reason
    ? `[Cancelamento por indisponibilidade] ${reason}`
    : '[Cancelamento por indisponibilidade]'
  let cancelledCount = 0

  for (const reservation of reservations) {
    const updateResult = await context.env.DB.prepare(
      `UPDATE reservas
       SET status = 'cancelada',
           nota_privada = ?,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'confirmada'`
    ).bind(privateNote, reservation.id).run()

    const wasCancelled = Number(updateResult?.meta?.changes ?? 0) > 0
    if (!wasCancelled) continue

    cancelledCount += 1
    sendReservationCancellation(context, {
      reservaId: reservation.id,
      clientEmail: reservation.client_email ?? null,
      clientName: reservation.client_name ?? 'Cliente',
      dataHora: reservation.data_hora,
      serviceName: reservation.service_name ?? 'Serviço',
      barberName: reservation.barber_name ?? 'Barbeiro',
      duracao: reservation.duration_minutes ?? 60,
      motivo: reason || null,
      resendLembreteId: reservation.resend_lembrete_id ?? null,
    })
  }

  return cancelledCount
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
        skip_conflict_check,
        cancel_reservation_ids,
        cancel_reason,
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

      const conflicts = await findConflictingReservations(env, barber_id, occurrences)
      if (!skip_conflict_check && conflicts.length > 0) {
        return jsonResponse({
          success: false,
          error: 'Existem reservas confirmadas no período da indisponibilidade.',
          data: {
            conflicts: conflicts.map(c => ({
              id: c.id,
              client_name: c.client_name,
              service_name: c.service_name,
              data_hora: c.data_hora,
              duration_minutes: Number(c.duration_minutes ?? 60),
            })),
          },
        }, 409)
      }

      let cancelledCount = 0
      if (skip_conflict_check && Array.isArray(cancel_reservation_ids) && cancel_reservation_ids.length > 0) {
        const validIds = new Set(
          cancel_reservation_ids
            .map(id => Number(id))
            .filter(id => Number.isInteger(id) && id > 0)
        )
        const selectedConflicts = conflicts.filter(conflict => validIds.has(Number(conflict.id)))
        cancelledCount = await cancelSelectedReservations(context, selectedConflicts, cancel_reason)
      }

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
        return created({ groupId, count: occurrences.length, cancelled_reservations: cancelledCount })
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

      return created({ id: r.meta.last_row_id, cancelled_reservations: cancelledCount })
    } catch (e) {
      return serverError('Erro ao criar indisponibilidade', e.message)
    }
  }

  return badRequest('Método não suportado')
}
