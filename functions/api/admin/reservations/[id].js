import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize, isValidDate, isValidTime, isValidId } from '../../../utils/validators.js'
import {
  sendReservationCancellation,
  cancelScheduledReminder,
  rescheduleReminder,
} from '../../../utils/reservationEmails.js'

const VALID_STATUSES = ['confirmada', 'cancelada', 'concluida', 'faltou']

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  const reservation = await env.DB.prepare(
    `SELECT r.id, r.status, r.data_hora, r.comentario, r.nota_privada,
            r.resend_lembrete_id,
            r.cliente_id, r.barbeiro_id, r.servico_id,
            v.cliente_nome, v.cliente_email,
            (SELECT foto_perfil FROM clientes c WHERE c.id = r.cliente_id) AS client_photo_url,
            v.barbeiro_nome,
            v.servico_nome,
            v.duracao_efetiva AS service_duration
     FROM reservas r
     JOIN v_reservas_complete v ON v.id = r.id
     WHERE r.id = ?`
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')

  if (request.method === 'GET') return ok(reservation)

  if (request.method === 'PATCH') {
    try {
      const body = await request.json()
      const {
        status,
        notes,
        private_note,
        barber_id,
        service_id,
        data_hora,
        comentario,
        nota_privada,
        service_duration,
        motivo,
      } = body

      if (status && !VALID_STATUSES.includes(status)) return badRequest('Status inválido')
      if (barber_id   !== undefined && !isValidId(barber_id))   return badRequest('ID de barbeiro inválido')
      if (service_id  !== undefined && !isValidId(service_id))  return badRequest('ID de serviço inválido')
      if (data_hora   !== undefined) {
        const [d, h] = data_hora.split('T')
        if (!isValidDate(d) || !isValidTime(h?.slice(0, 5))) return badRequest('Data/hora inválida')
      }

      const updates = []
      const vals    = []

      if (status          !== undefined) { updates.push('status = ?');           vals.push(status) }
      if (notes           !== undefined) { updates.push('comentario = ?');       vals.push(sanitize(notes, 2000)) }
      if (private_note    !== undefined) { updates.push('nota_privada = ?');     vals.push(sanitize(private_note, 2000)) }
      if (comentario      !== undefined) { updates.push('comentario = ?');       vals.push(sanitize(comentario, 2000)) }
      if (nota_privada    !== undefined) { updates.push('nota_privada = ?');     vals.push(sanitize(nota_privada, 2000)) }
      if (barber_id       !== undefined) { updates.push('barbeiro_id = ?');      vals.push(barber_id) }
      if (service_id      !== undefined) { updates.push('servico_id = ?');       vals.push(service_id) }
      if (data_hora       !== undefined) { updates.push('data_hora = ?');        vals.push(data_hora) }
      if (service_duration !== undefined && Number.isFinite(Number(service_duration))) {
        updates.push('duracao_minutos = ?')
        vals.push(Number(service_duration))
      }

      if (!updates.length) return badRequest('Nada para actualizar')

      updates.push('atualizado_em = CURRENT_TIMESTAMP')

      await env.DB.prepare(
        `UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...vals, id).run()

      // ── Acções pós-update ────────────────────────────────────────────────

      // 1. Cancelamento: APENAS cancelar o lembrete agendado.
      //    O email de cancelamento é enviado exclusivamente por cancel-email.js
      //    para evitar duplicados quando o frontend chama ambos os endpoints.
      if (status === 'cancelada') {
        const lembreteId = reservation.resend_lembrete_id ?? null
        console.log(
          `[admin/reservations/[id] PATCH] Reserva #${id} → cancelada.`,
          `resend_lembrete_id na BD: ${lembreteId ?? '(nenhum)'}`
        )
        if (lembreteId) {
          console.log(`[admin/reservations/[id] PATCH] A cancelar lembrete agendado ${lembreteId}…`)
          context.waitUntil(
            cancelScheduledReminder(context, lembreteId)
              .then(() =>
                env.DB.prepare('UPDATE reservas SET resend_lembrete_id = NULL WHERE id = ?')
                  .bind(id).run()
              )
              .catch(e => console.error('[admin/reservations/[id] PATCH] Erro ao cancelar lembrete:', e?.message))
          )
        } else {
          console.log(`[admin/reservations/[id] PATCH] Reserva #${id} sem lembrete agendado — nada a cancelar.`)
        }
      }

      // 2. Alteração de data/hora, barbeiro ou serviço: reagendar lembrete
      const changedRelevant = data_hora !== undefined || barber_id !== undefined || service_id !== undefined
      const notCancelled    = status !== 'cancelada'

      if (changedRelevant && notCancelled && reservation.cliente_email) {
        let newBarberName  = reservation.barbeiro_nome
        let newServiceName = reservation.servico_nome
        let newDuration    = reservation.service_duration
        let newDataHora    = data_hora ?? reservation.data_hora

        if (barber_id !== undefined) {
          const b = await env.DB.prepare('SELECT nome FROM barbeiros WHERE id = ?').bind(barber_id).first()
          if (b) newBarberName = b.nome
        }
        if (service_id !== undefined) {
          const s = await env.DB.prepare('SELECT nome, duracao FROM servicos WHERE id = ?').bind(service_id).first()
          if (s) { newServiceName = s.nome; newDuration = s.duracao ?? newDuration }
        }

        console.log(
          `[admin/reservations/[id] PATCH] Reserva #${id} — dados relevantes alterados.`,
          `oldLembreteId: ${reservation.resend_lembrete_id ?? '(nenhum)'},`,
          `nova data: ${newDataHora}`
        )

        context.waitUntil(
          rescheduleReminder(context, {
            reservaId:     reservation.id,
            oldLembreteId: reservation.resend_lembrete_id ?? null,
            clientEmail:   reservation.cliente_email,
            clientName:    reservation.cliente_nome,
            dataHora:      newDataHora,
            serviceName:   newServiceName,
            barberName:    newBarberName,
            duracao:       newDuration,
          })
        )
      }

      return ok({ message: 'Reserva actualizada' })
    } catch (e) {
      console.error('[admin/reservations/[id] PATCH] Erro inesperado:', e?.message)
      return serverError('Erro ao actualizar reserva', e.message)
    }
  }

  if (request.method === 'DELETE') {
    try {
      const lembreteId = reservation.resend_lembrete_id ?? null
      console.log(
        `[admin/reservations/[id] DELETE] A eliminar reserva #${id}.`,
        `resend_lembrete_id: ${lembreteId ?? '(nenhum)'}`
      )

      if (lembreteId) {
        console.log(`[admin/reservations/[id] DELETE] A cancelar lembrete agendado ${lembreteId}…`)
        await cancelScheduledReminder(context, lembreteId)
        console.log(`[admin/reservations/[id] DELETE] Lembrete ${lembreteId} cancelado (ou já inactivo).`)
      }

      await env.DB.prepare('DELETE FROM reservas WHERE id = ?').bind(id).run()
      console.log(`[admin/reservations/[id] DELETE] Reserva #${id} eliminada.`)
      return ok({ message: 'Reserva eliminada' })
    } catch (e) {
      console.error('[admin/reservations/[id] DELETE] Erro inesperado:', e?.message)
      return serverError('Erro ao eliminar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}
