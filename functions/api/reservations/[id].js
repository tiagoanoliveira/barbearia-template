import { authenticateClient } from '../../utils/auth.js'
import {
  sendReservationCancellation,
  rescheduleReminder,
} from '../../utils/reservationEmails.js'

import {
  ok,
  unauthorized,
  notFound,
  forbidden,
  badRequest,
  conflict,
  serverError,
  corsOptions,
} from '../../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../../utils/validators.js'
import { getNowLisboa } from '../../utils/time.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  const reservation = await env.DB.prepare(
      `SELECT
         r.id,
         r.cliente_id,
         r.barbeiro_id,
         r.servico_id,
         r.data_hora,
         r.status,
         r.comentario,
         r.historico_edicoes,
         r.duracao_minutos,
         r.resend_lembrete_id,
         c.nome  AS cliente_nome,
         c.email AS client_email,
         b.nome  AS barbeiro_nome,
         s.nome  AS servico_nome,
         s.duracao AS service_duration
       FROM reservas r
              JOIN clientes  c ON r.cliente_id  = c.id
              JOIN barbeiros b ON r.barbeiro_id = b.id
              JOIN servicos  s ON r.servico_id  = s.id
       WHERE r.id = ?`
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')
  if (reservation.cliente_id !== auth.clientId) return forbidden()

  // ─── DELETE: cancelar reserva ───────────────────────────────────────────────
  if (request.method === 'DELETE') {
    try {
      if (!['confirmada'].includes(reservation.status)) {
        return badRequest('Apenas reservas por concluir podem ser canceladas')
      }

      await env.DB.prepare(
        `UPDATE reservas
           SET status = 'cancelada', atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(id).run()

      // Notificação interna
      try {
        const dt      = new Date(reservation.data_hora)
        const dateStr = dt.toLocaleDateString('pt-PT')
        const timeStr = dt.toTimeString().substring(0, 5)
        const message = `${reservation.cliente_nome} cancelou a reserva com ${reservation.barbeiro_nome} de ${dateStr} às ${timeStr}`
        await insertNotification(env, {
          type: 'cancelled',
          message,
          reservationId: reservation.id,
          clientName: reservation.cliente_nome,
          barberId: reservation.barbeiro_id,
        })
      } catch (e) {
        console.error('[reservations/[id] DELETE] Erro ao criar notificação:', e)
      }

      const lembreteId = reservation.resend_lembrete_id ?? null
      console.log(
        `[reservations/[id] DELETE] Reserva #${id}: client_email=${reservation.client_email},`,
        `resend_lembrete_id lido da BD=${JSON.stringify(lembreteId)}`
      )

      // Email de cancelamento + cancelar lembrete (dentro de waitUntil para não ser cortado)
      context.waitUntil(
        (async () => {
          await sendReservationCancellation(context, {
            reservaId:        reservation.id,
            clientEmail:      reservation.client_email,
            clientName:       reservation.cliente_nome,
            dataHora:         reservation.data_hora,
            serviceName:      reservation.servico_nome,
            barberName:       reservation.barbeiro_nome,
            duracao:          reservation.service_duration ?? reservation.duracao_minutos,
            motivo:           null,
            resendLembreteId: lembreteId,
          })
        })()
      )

      return ok({ message: 'Reserva cancelada' })
    } catch (e) {
      console.error('[reservations/[id] DELETE] Erro inesperado:', e?.message)
      return serverError('Erro ao cancelar reserva', e.message)
    }
  }

  // ─── PUT: editar reserva ────────────────────────────────────────────────────
  if (request.method === 'PUT') {
    try {
      const body = await request.json()
      const date = body.date
      const time = body.time
      const notes = body.notes ?? body.comentario ?? ''
      const newBarberId  = body.barber_id && isValidId(body.barber_id) ? body.barber_id : reservation.barbeiro_id
      const newServiceId = body.service_id && isValidId(body.service_id) ? body.service_id : reservation.servico_id

      if (!isValidDate(date)) return badRequest('Data inválida')
      if (!isValidTime(time)) return badRequest('Hora inválida')

      const now      = getNowLisboa()
      const current  = new Date(reservation.data_hora)
      const diffHrs  = (current.getTime() - now.getTime()) / (1000 * 60 * 60)

      if (diffHrs < 5) {
        return badRequest('Só é possível editar reservas com pelo menos 5 horas de antecedência')
      }

      if (!['confirmada'].includes(reservation.status)) {
        return badRequest('Apenas reservas por concluir podem ser editadas')
      }

      const newDataHora = `${date}T${time}:00`
      const newDateObj  = new Date(newDataHora)
      if (newDateObj <= now) return badRequest('Não pode reagendar para datas passadas')

      let newBarberName = reservation.barbeiro_nome
      if (newBarberId !== reservation.barbeiro_id) {
        const b = await env.DB.prepare('SELECT id, nome FROM barbeiros WHERE id = ?').bind(newBarberId).first()
        if (!b) return badRequest('Barbeiro inválido')
        newBarberName = b.nome
      }

      let newServiceName = reservation.servico_nome
      let newDuration    = reservation.duracao_minutos
      if (newServiceId !== reservation.servico_id) {
        const s = await env.DB.prepare('SELECT id, nome, duracao FROM servicos WHERE id = ?').bind(newServiceId).first()
        if (!s) return badRequest('Serviço inválido')
        newServiceName = s.nome
        newDuration    = s.duracao ?? reservation.duracao_minutos
      }

      const [conflictBarber, conflictClient] = await Promise.all([
        env.DB.prepare(
          `SELECT id FROM reservas
            WHERE barbeiro_id = ? AND data_hora = ?
              AND status IN ('confirmada','faltou','concluida')
              AND id != ?
            LIMIT 1`
        ).bind(newBarberId, newDataHora, reservation.id).first(),
        env.DB.prepare(
          `SELECT id FROM reservas
             WHERE cliente_id = ? AND data_hora = ?
               AND status IN ('confirmada','faltou','concluida')
               AND id != ?
             LIMIT 1`
        ).bind(reservation.cliente_id, newDataHora, reservation.id).first(),
      ])

      if (conflictBarber) return conflict('Horário já reservado')
      if (conflictClient) return conflict('Já tem uma reserva neste horário')

      const sanitizedComment = sanitize(notes ?? '', 2000)

      const changes = {}
      if (reservation.data_hora !== newDataHora) {
        changes.data_hora = { anterior: reservation.data_hora, novo: newDataHora }
      }
      if ((reservation.comentario ?? '') !== sanitizedComment) {
        changes.comentario = true
      }
      if (newBarberId !== reservation.barbeiro_id) {
        changes.barbeiro = { anterior: reservation.barbeiro_nome, novo: newBarberName }
      }
      if (newServiceId !== reservation.servico_id) {
        changes.servico = { anterior: reservation.servico_nome, novo: newServiceName }
      }

      let history = []
      try {
        history = JSON.parse(reservation.historico_edicoes || '[]')
        if (!Array.isArray(history)) history = []
      } catch {
        history = []
      }

      history.push({ date: new Date().toISOString(), changed_by: 'client', changes })

      await env.DB.prepare(
        `UPDATE reservas
           SET barbeiro_id = ?, servico_id = ?, data_hora = ?, comentario = ?, duracao_minutos = ?,
               historico_edicoes = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        newBarberId,
        newServiceId,
        newDataHora,
        sanitizedComment,
        newDuration,
        JSON.stringify(history),
        reservation.id,
      ).run()

      try {
        const message = buildEditedMessage(reservation.cliente_nome, changes)
        await insertNotification(env, {
          type: 'edited',
          message,
          reservationId: reservation.id,
          clientName: reservation.cliente_nome,
          barberId: newBarberId,
        })
      } catch (e) {
        console.error('[reservations/[id] PUT] Erro ao criar notificação:', e)
      }

      const needsReschedule = changes.data_hora || changes.barbeiro || changes.servico
      const lembreteId      = reservation.resend_lembrete_id ?? null

      console.log(
        `[reservations/[id] PUT] Reserva #${id}: needsReschedule=${!!needsReschedule},`,
        `client_email=${reservation.client_email},`,
        `resend_lembrete_id lido da BD=${JSON.stringify(lembreteId)}`
      )

      if (needsReschedule && reservation.client_email) {
        console.log(`[reservations/[id] PUT] Reserva #${id}: a reagendar lembrete…`)
        context.waitUntil(
          rescheduleReminder(context, {
            reservaId:     reservation.id,
            oldLembreteId: lembreteId,
            clientEmail:   reservation.client_email,
            clientName:    reservation.cliente_nome,
            dataHora:      newDataHora,
            serviceName:   newServiceName,
            barberName:    newBarberName,
            duracao:       newDuration,
          })
        )
      } else if (needsReschedule && !reservation.client_email) {
        console.warn(`[reservations/[id] PUT] Reserva #${id}: needsReschedule=true mas client_email está vazio — lembrete não reagendado.`)
      }

      return ok({ message: 'Reserva atualizada' })
    } catch (e) {
      console.error('[reservations/[id] PUT] Erro inesperado:', e?.message)
      return serverError('Erro ao editar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}

async function insertNotification(env, { type, message, reservationId, clientName, barberId }) {
  try {
    await env.DB.prepare(
      `INSERT INTO notifications (type, message, reservation_id, client_name, barber_id)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(type, message, reservationId, clientName, barberId).run()
  } catch (e) {
    console.error('Erro ao inserir notificação:', e)
  }
}

function buildEditedMessage(clientName, changes) {
  const hasSubstantial = changes.barbeiro || changes.servico || changes.data_hora

  if (changes.comentario === true && !hasSubstantial) {
    return `${clientName} adicionou uma nota à reserva`
  }

  const parts = []

  if (changes.barbeiro) {
    parts.push(`barbeiro (${changes.barbeiro.anterior} → ${changes.barbeiro.novo})`)
  }
  if (changes.servico) {
    parts.push(`serviço (${changes.servico.anterior} → ${changes.servico.novo})`)
  }
  if (changes.data_hora) {
    try {
      const prev = new Date(changes.data_hora.anterior)
      const next = new Date(changes.data_hora.novo)
      const prevDate = prev.toLocaleDateString('pt-PT')
      const prevTime = prev.toTimeString().substring(0, 5)
      const nextDate = next.toLocaleDateString('pt-PT')
      const nextTime = next.toTimeString().substring(0, 5)
      parts.push(`data/hora (${prevDate} ${prevTime} → ${nextDate} ${nextTime})`)
    } catch {
      parts.push('data/hora')
    }
  }

  if (parts.length === 0) return `${clientName} alterou a reserva`
  return `${clientName} alterou: ${parts.join(', ')}`
}
