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
    const endDate = new Date(end ?? start)
    const stopDate = new Date(recurrenceEndDate)
    const diffMs = endDate.getTime() - startDate.getTime()
    const inserts = []
    let cursor = new Date(startDate)

    while (cursor <= stopDate) {
      const recStart = new Date(cursor)
      const recEnd = new Date(cursor.getTime() + diffMs)
      inserts.push(normalizeOccurrence(recStart.toISOString(), recEnd.toISOString()))
      if (recurrenceType === 'daily') cursor.setDate(cursor.getDate() + 1)
      else if (recurrenceType === 'weekly') cursor.setDate(cursor.getDate() + 7)
      else break
      if (inserts.length > 365) break
    }
    return inserts
  }

  return [normalizeOccurrence(start, end ?? start)]
}

async function findOverlappingReservations(env, barberId, occurrences, onlyIds = null) {
  if (!occurrences.length) return []
  const overlapSql = occurrences.map(() =>
    `(r.data_hora < ? AND datetime(r.data_hora, '+' || COALESCE(r.duracao_minutos, 60) || ' minutes') > ?)`
  ).join(' OR ')
  const overlapParams = occurrences.flatMap(o => [o.end, o.start])

  const idFilter = Array.isArray(onlyIds) && onlyIds.length
    ? `AND r.id IN (${onlyIds.map(() => '?').join(',')})`
    : ''

  const { results } = await env.DB.prepare(`
    SELECT
      r.id,
      r.data_hora,
      r.nota_privada,
      r.resend_lembrete_id,
      c.nome AS client_name,
      c.email AS client_email,
      s.nome AS service_name,
      COALESCE(r.duracao_minutos, s.duracao, 60) AS service_duration,
      b.nome AS barber_name
    FROM reservas r
    JOIN clientes c ON c.id = r.cliente_id
    JOIN servicos s ON s.id = r.servico_id
    JOIN barbeiros b ON b.id = r.barbeiro_id
    WHERE r.barbeiro_id = ?
      AND r.status = 'confirmada'
      AND (${overlapSql})
      ${idFilter}
    ORDER BY r.data_hora
  `).bind(
    barberId,
    ...overlapParams,
    ...(Array.isArray(onlyIds) && onlyIds.length ? onlyIds : []),
  ).all()

  return results ?? []
}

function buildCancellationPrivateNote(existing, reason) {
  const prefix = `[Cancelamento por indisponibilidade] ${reason}`
  const previous = sanitize(existing ?? '', 2000)
  if (!previous) return prefix
  if (previous.includes(prefix)) return previous
  return `${prefix}\n${previous}`.slice(0, 2000)
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

      // Barbeiros só podem ver as suas próprias indisponibilidades
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
        cancel_reservation_ids,
        cancel_reason,
        skip_conflict_check,
      } = body

      if (!isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
      if (!start)                return badRequest('Data de início obrigatória')

      // Barbeiro só pode criar indisponibilidades para si próprio
      if (user.role === 'barbeiro' && user.barbeiro_id && user.barbeiro_id !== barber_id) {
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

      if (!skip_conflict_check) {
        const conflicts = await findOverlappingReservations(env, barber_id, occurrences)
        if (conflicts.length) {
          return jsonResponse({
            success: false,
            error: 'Existem reservas confirmadas no período selecionado.',
            data: { conflicts },
          }, 409)
        }
      }

      const selectedReservationIds = Array.isArray(cancel_reservation_ids)
        ? [...new Set(cancel_reservation_ids.map(Number).filter(id => Number.isFinite(id) && id > 0))]
        : []
      const cancelReason = sanitize(cancel_reason ?? '', 1000)
      if (selectedReservationIds.length && !cancelReason) {
        return badRequest('O motivo de cancelamento é obrigatório.')
      }

      let cancelledReservations = []
      if (selectedReservationIds.length) {
        const toCancel = await findOverlappingReservations(env, barber_id, occurrences, selectedReservationIds)
        if (!toCancel.length) {
          return badRequest('Não existem reservas válidas para cancelar na seleção.')
        }
        const updateStmt = env.DB.prepare(
          `UPDATE reservas
              SET status = 'cancelada',
                  nota_privada = ?,
                  atualizado_em = CURRENT_TIMESTAMP
            WHERE id = ?`
        )
        await env.DB.batch(
          toCancel.map(r => updateStmt.bind(buildCancellationPrivateNote(r.nota_privada, cancelReason), r.id))
        )
        toCancel.forEach(r => {
          sendReservationCancellation(context, {
            reservaId: r.id,
            clientEmail: r.client_email,
            clientName: r.client_name,
            dataHora: r.data_hora,
            serviceName: r.service_name,
            barberName: r.barber_name,
            duracao: r.service_duration,
            motivo: cancelReason,
            resendLembreteId: r.resend_lembrete_id ?? null,
          })
        })
        cancelledReservations = toCancel.map(r => r.id)
      }

      // Para recorrências, gerar um group_id e criar múltiplos registos
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
            stmt.bind(
              barber_id, s, e,
              is_all_day ? 1 : 0,
              tipo, sanitize(reason ?? '', 200),
              rec, recurrence_end_date, groupId,
            ),
          ),
        )

        return created({ groupId, count: occurrences.length, cancelled_reservation_ids: cancelledReservations })
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
        rec, recurrence_end_date ?? null,
      ).run()

      return created({ id: r.meta.last_row_id, cancelled_reservation_ids: cancelledReservations })
    } catch (e) {
      return serverError('Erro ao criar indisponibilidade', e.message)
    }
  }

  return badRequest('Método não suportado')
}
