import { ok, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'
import { authenticateAdmin } from '../../../utils/auth.js'
import { sendEmail, buildReservationCancellationEmail } from '../../../utils/email.js'
import { cancelScheduledReminder } from '../../../utils/reservationEmails.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), { status: 401 })

  try {
    const { reservation_id, reason } = await request.json()
    if (!reservation_id) return badRequest('reservation_id obrigatório')

    console.log(`[cancel-email] Pedido de cancelamento para reserva #${reservation_id}. Motivo: ${reason ?? '(sem motivo)'}`)

    const row = await env.DB.prepare(`
      SELECT r.id, r.data_hora, r.nota_privada, r.resend_lembrete_id,
             c.email AS client_email, c.nome AS client_name,
             s.nome  AS service_name, s.duracao AS duracao,
             b.nome  AS barber_name
      FROM   reservas r
      JOIN   clientes  c ON r.cliente_id  = c.id
      JOIN   servicos  s ON r.servico_id  = s.id
      JOIN   barbeiros b ON r.barbeiro_id = b.id
      WHERE  r.id = ?
    `).bind(reservation_id).first()

    if (!row) return notFound('Reserva não encontrada')

    console.log(
      `[cancel-email] Reserva #${reservation_id} encontrada.`,
      `client_email: ${row.client_email ?? '(nenhum)'},`,
      `resend_lembrete_id: ${row.resend_lembrete_id ?? '(nenhum)'}`
    )

    // 1. Guardar motivo na nota_privada
    if (reason) {
      const nota = row.nota_privada
        ? `${row.nota_privada}\n[Cancelamento] ${reason}`
        : `[Cancelamento] ${reason}`
      await env.DB.prepare('UPDATE reservas SET nota_privada = ? WHERE id = ?')
        .bind(nota, reservation_id).run()
    }

    // 2. Cancelar lembrete agendado (se existir)
    if (row.resend_lembrete_id) {
      console.log(`[cancel-email] A cancelar lembrete agendado ${row.resend_lembrete_id}…`)
      await cancelScheduledReminder(context, row.resend_lembrete_id)
      await env.DB.prepare('UPDATE reservas SET resend_lembrete_id = NULL WHERE id = ?')
        .bind(reservation_id).run()
      console.log(`[cancel-email] Lembrete ${row.resend_lembrete_id} cancelado e coluna limpa.`)
    } else {
      console.log(`[cancel-email] Reserva #${reservation_id} sem lembrete agendado — nada a cancelar.`)
    }

    // 3. Enviar email de cancelamento ao cliente
    if (!row.client_email) {
      console.warn(`[cancel-email] Reserva #${reservation_id} sem email de cliente — email não enviado.`)
      return ok({ message: 'Sem email – não enviado' })
    }

    console.log(`[cancel-email] A enviar email de cancelamento para ${row.client_email}…`)

    const { html, attachments } = buildReservationCancellationEmail({
      reservaId:   row.id,
      clientName:  row.client_name,
      clientEmail: row.client_email,
      dataHora:    row.data_hora,
      serviceName: row.service_name,
      barberName:  row.barber_name,
      duracao:     row.duracao,
      motivo:      reason || null,
    })

    await sendEmail(context, {
      to:          row.client_email,
      subject:     'A tua reserva foi cancelada – Brooklyn Barbearia',
      html,
      attachments,
    })

    console.log(`[cancel-email] Email de cancelamento enviado para ${row.client_email}.`)
    return ok({ message: 'Email de cancelamento enviado' })
  } catch (e) {
    console.error('[cancel-email] Erro inesperado:', e?.message)
    return serverError('Erro ao enviar email', e.message)
  }
}
