import { createResponse, createErrorResponse, authenticateAdmin } from '../../../utils/auth.js'
import { getDB } from '../../../utils/db.js'
import { sendEmail, buildReservationCancellationEmail } from '../../../utils/email.js'

export async function onRequestPost(context) {
  const auth = await authenticateAdmin(context)
  if (!auth.success) return createErrorResponse(auth.error, 401)

  const { reservation_id, reason } = await context.request.json()
  if (!reservation_id) return createErrorResponse('reservation_id obrigatório', 400)

  const db = getDB(context)
  const row = await db.prepare(`
    SELECT r.id, r.data_hora, r.nota_privada,
           c.email AS client_email, c.nome AS client_name,
           s.nome AS service_name, s.duracao AS duracao,
           b.nome AS barber_name
    FROM   reservas r
    JOIN   clientes c ON r.cliente_id = c.id
    JOIN   servicos s ON r.servico_id = s.id
    JOIN   barbeiros b ON r.barbeiro_id = b.id
    WHERE  r.id = ?
  `).bind(reservation_id).first()

  if (!row) return createErrorResponse('Reserva não encontrada', 404)

  // Guardar motivo na nota_privada
  if (reason) {
    const existing = row.nota_privada ?? ''
    const nota = existing
      ? `${existing}\n[Cancelamento] ${reason}`
      : `[Cancelamento] ${reason}`
    await db.prepare('UPDATE reservas SET nota_privada = ? WHERE id = ?').bind(nota, reservation_id).run()
  }

  if (!row.client_email) return createResponse({ ok: true, message: 'Sem email – não enviado' })

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

  return createResponse({ ok: true, message: 'Email enviado' })
}
