import { authenticateAdmin } from '../../../utils/auth.js'
import { canAccessReservation } from '../../../utils/authz.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize, isValidDate, isValidTime, isValidId } from '../../../utils/validators.js'
import {
  sendReservationCancellation,
  cancelScheduledReminder,
  rescheduleReminder,
} from '../../../utils/reservationEmails.js'

const VALID_STATUSES = ['confirmada', 'cancelada', 'concluida', 'faltou']
// null = sem pagamento (oferta total); string = meio escolhido pelo barbeiro
const VALID_MEIOS    = ['multibanco', 'dinheiro', 'outro']

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
            r.meio_pagamento, r.valor_pago, r.gorjeta, r.meio_gorjeta,
            r.comentario_pagamento,
            r.oferta_valor, r.oferta_tipo,
            v.cliente_nome, v.cliente_email,
            (SELECT foto_perfil FROM clientes c WHERE c.id = r.cliente_id) AS client_photo_url,
            v.barbeiro_nome,
            v.servico_nome,
            v.duracao_efetiva AS service_duration,
            v.servico_preco   AS service_price,
            (SELECT reservas_gratuitas_disponiveis FROM clientes c WHERE c.id = r.cliente_id) AS client_free_reservations
     FROM reservas r
     JOIN v_reservas_complete v ON v.id = r.id
     WHERE r.id = ?`
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')

  // Barbeiros só podem aceder às suas próprias reservas
  if (!canAccessReservation(auth, reservation.barbeiro_id)) {
    console.warn('admin/reservations/[id]: acesso negado', { role: auth.user?.role, barbeiro_id: auth.user?.barbeiro_id, reservaBarbeiroId: reservation.barbeiro_id })
    return unauthorized('Sem permissões para aceder a esta reserva')
  }

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
        meio_pagamento,
        valor_pago,
        gorjeta,
        meio_gorjeta,
        comentario_pagamento,
        // Campos de oferta
        oferta_valor,
        oferta_tipo,
      } = body

      if (status && !VALID_STATUSES.includes(status)) return badRequest('Status inválido')
      if (barber_id   !== undefined && !isValidId(barber_id))   return badRequest('ID de barbeiro inválido')
      if (service_id  !== undefined && !isValidId(service_id))  return badRequest('ID de serviço inválido')
      if (data_hora   !== undefined) {
        const [d, h] = data_hora.split('T')
        if (!isValidDate(d) || !isValidTime(h?.slice(0, 5))) return badRequest('Data/hora inválida')
      }

      // Validar oferta_valor: deve ser inteiro não-negativo se fornecido
      if (oferta_valor !== undefined && oferta_valor !== null) {
        const v = Number(oferta_valor)
        if (!Number.isInteger(v) || v < 0) return badRequest('oferta_valor deve ser um inteiro não-negativo (cêntimos)')
      }

      // Validar meio_pagamento:
      //   null  → oferta total (sem cobranças) — válido
      //   string → deve estar em VALID_MEIOS
      if (meio_pagamento !== undefined && meio_pagamento !== null) {
        if (!VALID_MEIOS.includes(meio_pagamento)) return badRequest('Meio de pagamento inválido')
      }

      // Validar meio_gorjeta (nunca pode ser null)
      if (meio_gorjeta !== undefined) {
        if (!VALID_MEIOS.includes(meio_gorjeta)) return badRequest('Meio de gorjeta inválido')
      }

      // Validar comentário obrigatório quando o método é 'outro'
      const effectiveComentario = comentario_pagamento ?? reservation.comentario_pagamento ?? ''
      if (meio_pagamento === 'outro' && !effectiveComentario.trim()) {
        return badRequest('O campo "Observações de Pagamento" é obrigatório quando o método é "Outro".')
      }
      if (meio_gorjeta === 'outro' && !effectiveComentario.trim()) {
        return badRequest('O campo "Observações de Pagamento" é obrigatório quando o método de gorjeta é "Outro".')
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

      // meio_pagamento: null (oferta total) ou string válida
      if (meio_pagamento !== undefined) {
        updates.push('meio_pagamento = ?')
        vals.push(meio_pagamento) // null é guardado como NULL na BD
      }
      if (valor_pago !== undefined && Number.isFinite(Number(valor_pago))) {
        updates.push('valor_pago = ?')
        vals.push(Number(valor_pago))
      }
      if (gorjeta !== undefined && Number.isFinite(Number(gorjeta))) {
        updates.push('gorjeta = ?')
        vals.push(Number(gorjeta))
      }
      if (meio_gorjeta !== undefined) {
        updates.push('meio_gorjeta = ?')
        vals.push(meio_gorjeta)
      }
      if (comentario_pagamento !== undefined) {
        updates.push('comentario_pagamento = ?')
        vals.push(sanitize(comentario_pagamento, 1000))
      }

      // Campos de oferta
      if (oferta_valor !== undefined) {
        updates.push('oferta_valor = ?')
        vals.push(oferta_valor === null ? null : Number(oferta_valor))
      }
      if (oferta_tipo !== undefined) {
        updates.push('oferta_tipo = ?')
        vals.push(oferta_tipo === null ? null : String(oferta_tipo).trim())
      }

      if (!updates.length) return badRequest('Nada para actualizar')

      updates.push('atualizado_em = CURRENT_TIMESTAMP')

      await env.DB.prepare(
        `UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...vals, id).run()

      // ── Acções pós-update ────────────────────────────────────────────────

      // 1. Cancelamento
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
