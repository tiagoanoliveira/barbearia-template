import { authenticateClient } from '../utils/auth.js'
import {
  ok, created, badRequest, unauthorized, notFound,
  conflict, serverError, corsOptions
} from '../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../utils/validators.js'
import { sendEmail, buildReservationConfirmationEmail } from '../utils/email.js'
import { getNowLisboa } from '../utils/time.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { service_id, barber_id, date, time, notes } = body

      const anyBarber = !barber_id || barber_id === 'any' || barber_id === 0

      if (!isValidId(service_id)) return badRequest('ID do serviço inválido')
      if (!anyBarber && !isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))     return badRequest('Data inválida')
      if (!isValidTime(time))     return badRequest('Hora inválida')

      const dataHora = `${date}T${time}:00`
      if (new Date(dataHora) <= getNowLisboa()) return badRequest('Não pode reservar para datas passadas')

      const service = await env.DB.prepare(
        'SELECT id, nome, duracao FROM servicos WHERE id = ?'
      ).bind(service_id).first()
      if (!service) return notFound('Serviço não encontrado')

      let finalBarberId

      if (anyBarber) {
        finalBarberId = await pickBarber(env, date, time, service.duracao || 60)
        if (!finalBarberId) return conflict('Sem barbeiros disponíveis neste horário')
      } else {
        finalBarberId = Number(barber_id)
      }

      const [conflictBarber, conflictClient, barber] = await Promise.all([
        env.DB.prepare(
          `SELECT id FROM reservas WHERE barbeiro_id = ? AND data_hora = ?
           AND status IN ('confirmada','faltou','concluida') LIMIT 1`
        ).bind(finalBarberId, dataHora).first(),
        env.DB.prepare(
          `SELECT id FROM reservas WHERE cliente_id = ? AND data_hora = ?
           AND status IN ('confirmada','faltou','concluida') LIMIT 1`
        ).bind(auth.clientId, dataHora).first(),
        env.DB.prepare(
          'SELECT id, nome FROM barbeiros WHERE id = ? AND ativo = 1'
        ).bind(finalBarberId).first(),
      ])

      if (conflictBarber) return conflict('Horário já reservado')
      if (conflictClient) return conflict('Já tem uma reserva neste horário')
      if (!barber)        return notFound('Barbeiro não encontrado')

      const result = await env.DB.prepare(
        `INSERT INTO reservas
           (cliente_id, barbeiro_id, servico_id, data_hora, comentario, duracao_minutos, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'online')`
      ).bind(
        auth.clientId, finalBarberId, service_id,
        dataHora, sanitize(notes ?? '', 2000),
        service.duracao || 60
      ).run()

      const reservationId = result.meta.last_row_id

      await env.DB.prepare(
        `INSERT INTO notifications (type, message, reservation_id, client_name, barber_id)
         VALUES ('new_booking', ?, ?, ?, ?)`
      ).bind(
        `Nova reserva: cliente ${auth.clientId} às ${time}`,
        reservationId,
        String(auth.clientId),
        finalBarberId
      ).run().catch(() => {})

      // Aguarda envio de email e regista erro detalhado para diagnóstico no Cloudflare Logs
      context.waitUntil(
          sendConfirmationEmail(context, {
            reservationId,
            clientId:    auth.clientId,
            barberName:  barber.nome,
            serviceName: service.nome,
            duracao:     service.duracao || 60,
            dataHora,
          }).catch(err => console.error(
              '[reservations] Falha ao enviar email de confirmação:',
              JSON.stringify({
                message:     err?.message,
                cause:       err?.cause,
                key_present: !!context.env?.RESEND_API_KEY,
                reservationId,
              })
          ))
      )

      return created({ id: reservationId, barber_id: finalBarberId, barber_name: barber.nome })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}

async function pickBarber(env, date, time, duration) {
  const dataHora   = `${date}T${time}:00`
  const dateObj    = new Date(date)
  const yesterday  = new Date(dateObj)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const { results: barbers } = await env.DB.prepare(
    'SELECT id FROM barbeiros WHERE ativo = 1'
  ).all()
  if (!barbers.length) return null

  const available = []
  for (const b of barbers) {
    const occupied = await env.DB.prepare(
      `SELECT id FROM reservas
       WHERE barbeiro_id = ? AND data_hora = ?
       AND status IN ('confirmada','faltou','concluida') LIMIT 1`
    ).bind(b.id, dataHora).first()

    const unavailable = await env.DB.prepare(
      `SELECT id FROM horarios_indisponiveis
       WHERE barbeiro_id = ? AND is_all_day = 1 AND date(data_hora_inicio) <= ? AND date(data_hora_fim) >= ?
       LIMIT 1`
    ).bind(b.id, date, date).first()

    if (!occupied && !unavailable) available.push(b.id)
  }

  if (!available.length) return null
  if (available.length === 1) return available[0]

  const todayCounts = await Promise.all(
    available.map(async id => {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM reservas
         WHERE barbeiro_id = ? AND date(data_hora) = ?
         AND status IN ('confirmada','faltou','concluida')`
      ).bind(id, date).first()
      return { id, today: row?.cnt ?? 0 }
    })
  )
  const minToday = Math.min(...todayCounts.map(r => r.today))
  const afterToday = todayCounts.filter(r => r.today === minToday)
  if (afterToday.length === 1) return afterToday[0].id

  const yesterdayCounts = await Promise.all(
    afterToday.map(async ({ id }) => {
      const row = await env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM reservas
         WHERE barbeiro_id = ? AND date(data_hora) = ?
         AND status IN ('confirmada','faltou','concluida')`
      ).bind(id, yesterdayStr).first()
      return { id, yesterday: row?.cnt ?? 0 }
    })
  )
  const minYest = Math.min(...yesterdayCounts.map(r => r.yesterday))
  const afterYest = yesterdayCounts.filter(r => r.yesterday === minYest)
  if (afterYest.length === 1) return afterYest[0].id

  return afterYest[Math.floor(Math.random() * afterYest.length)].id
}

async function sendConfirmationEmail(context, { reservationId, clientId, barberName, serviceName, duracao, dataHora }) {
  const { env } = context
  if (!env.RESEND_API_KEY) {
    console.warn('[sendConfirmationEmail] RESEND_API_KEY não definida — email não enviado.')
    return
  }

  const client = await env.DB.prepare(
    'SELECT nome, email FROM clientes WHERE id = ?'
  ).bind(clientId).first()

  if (!client?.email) {
    console.warn(`[sendConfirmationEmail] Cliente ${clientId} sem email — email não enviado.`)
    return
  }

  const { html, attachments } = buildReservationConfirmationEmail({
    reservaId:   reservationId,
    clientName:  client.nome,
    clientEmail: client.email,
    dataHora,
    serviceName,
    barberName,
    duracao,
  })

  await sendEmail(context, {
    to:      client.email,
    subject: `Reserva #${reservationId} confirmada – Brooklyn Barbearia`,
    html,
    attachments,
  })
}
