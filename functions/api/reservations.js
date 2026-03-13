import { authenticateClient } from '../utils/auth.js'
import {
  ok, created, badRequest, unauthorized, notFound,
  conflict, forbidden, serverError, corsOptions
} from '../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  // POST — Criar reserva
  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { service_id, barber_id, date, time, notes } = body

      if (!isValidId(service_id))  return badRequest('ID do serviço inválido')
      if (!isValidId(barber_id))   return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))      return badRequest('Data inválida')
      if (!isValidTime(time))      return badRequest('Hora inválida')

      const dataHora = `${date}T${time}:00`
      if (new Date(dataHora) <= new Date()) return badRequest('Não pode reservar para datas passadas')

      // Verificar conflitos e buscar dados em paralelo
      const [conflictBarber, conflictClient, service, barber] = await Promise.all([
        env.DB.prepare(
          `SELECT id FROM reservas WHERE barbeiro_id = ? AND data_hora = ?
           AND status IN ('confirmada','faltou','concluida') LIMIT 1`
        ).bind(barber_id, dataHora).first(),
        env.DB.prepare(
          `SELECT id FROM reservas WHERE cliente_id = ? AND data_hora = ?
           AND status IN ('confirmada','faltou','concluida') LIMIT 1`
        ).bind(auth.clientId, dataHora).first(),
        env.DB.prepare('SELECT id, nome, duracao FROM servicos WHERE id = ?').bind(service_id).first(),
        env.DB.prepare('SELECT id, nome FROM barbeiros WHERE id = ? AND ativo = 1').bind(barber_id).first(),
      ])

      if (conflictBarber) return conflict('Horário já reservado')
      if (conflictClient) return conflict('Já tem uma reserva neste horário')
      if (!service)       return notFound('Serviço não encontrado')
      if (!barber)        return notFound('Barbeiro não encontrado')

      const result = await env.DB.prepare(
        `INSERT INTO reservas (cliente_id, barbeiro_id, servico_id, data_hora, comentario, duracao_minutos, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'online')`
      ).bind(
        auth.clientId, barber_id, service_id,
        dataHora, sanitize(notes ?? '', 2000),
        service.duracao || 60
      ).run()

      // Enviar email de confirmação (fire-and-forget)
      sendConfirmationEmail(env, {
        reservationId: result.meta.last_row_id,
        clientId: auth.clientId,
        barberName: barber.nome,
        serviceName: service.nome,
        dataHora,
      }).catch(console.error)

      return created({ id: result.meta.last_row_id })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}

// Fire-and-forget: envia email via Resend
async function sendConfirmationEmail(env, { reservationId, clientId, barberName, serviceName, dataHora }) {
  if (!env.RESEND_API_KEY) return

  const client = await env.DB.prepare('SELECT nome, email FROM clientes WHERE id = ?').bind(clientId).first()
  if (!client?.email) return

  const dt = new Date(dataHora)
  const dateStr = dt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Brooklyn Barbearia <noreply@brooklynbarbearia.pt>',
      to:   client.email,
      subject: `Reserva #${reservationId} confirmada — Brooklyn Barbearia`,
      html: `
        <h2>Reserva confirmada!</h2>
        <p>Olá <strong>${client.nome}</strong>,</p>
        <p>A tua reserva foi confirmada com sucesso:</p>
        <ul>
          <li><strong>Serviço:</strong> ${serviceName}</li>
          <li><strong>Barbeiro:</strong> ${barberName}</li>
          <li><strong>Data:</strong> ${dateStr}</li>
          <li><strong>Hora:</strong> ${timeStr}</li>
        </ul>
        <p>Qualquer dúvida, entra em contacto connosco.</p>
        <p>Obrigado pela preferência!</p>
        <p><em>Brooklyn Barbearia</em></p>
      `,
    }),
  })
}
