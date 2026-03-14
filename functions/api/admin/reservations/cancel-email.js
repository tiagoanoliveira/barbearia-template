import { ok, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'
import { authenticateAdmin } from '../../../utils/auth.js'
import { sendEmail, buildReservationCancellationEmail } from '../../../utils/email.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return new Response(JSON.stringify({ success: false, error: 'Não autenticado' }), { status: 401 })

  try {
    const { reservation_id, reason } = await request.json()
    if (!reservation_id) return badRequest('reservation_id obrigatório')

    const row = await env.DB.prepare(`
      SELECT r.id, r.data_hora, r.nota_privada,
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

    // Guardar motivo na nota_privada
    if (reason) {
      const nota = row.nota_privada
        ? `${row.nota_privada}\n[Cancelamento] ${reason}`
        : `[Cancelamento] ${reason}`
      await env.DB.prepare('UPDATE reservas SET nota_privada = ? WHERE id = ?')
        .bind(nota, reservation_id).run()
    }

    if (!row.client_email) {
      return ok({ message: 'Sem email – não enviado' })
    }

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

    return ok({ message: 'Email de cancelamento enviado' })
  } catch (e) {
    return serverError('Erro ao enviar email', e.message)
  }
}
