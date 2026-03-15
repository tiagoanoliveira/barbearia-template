import { authenticateClient } from '../utils/auth.js'
import {
  ok, created, badRequest, unauthorized, notFound,
  conflict, serverError, corsOptions
} from '../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { service_id, barber_id, date, time, notes } = body

      // barber_id pode ser null/0/'any' para "Sem preferência"
      const anyBarber = !barber_id || barber_id === 'any' || barber_id === 0

      if (!isValidId(service_id)) return badRequest('ID do serviço inválido')
      if (!anyBarber && !isValidId(barber_id)) return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))     return badRequest('Data inválida')
      if (!isValidTime(time))     return badRequest('Hora inválida')

      const dataHora = `${date}T${time}:00`
      if (new Date(dataHora) <= new Date()) return badRequest('Não pode reservar para datas passadas')

      const service = await env.DB.prepare(
        'SELECT id, nome, duracao FROM servicos WHERE id = ?'
      ).bind(service_id).first()
      if (!service) return notFound('Serviço não encontrado')

      let finalBarberId

      if (anyBarber) {
        // Algoritmo de distribuição:
        // 1º barbeiro com menos reservas no dia
        // 2º barbeiro com menos reservas no dia anterior
        // 3º aleatório entre os disponíveis no slot
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

      await env.DB.prepare(
        `INSERT INTO notifications (type, message, reservation_id, client_name, barber_id)
         VALUES ('new_booking', ?, ?, ?, ?)`
      ).bind(
        `Nova reserva: cliente ${auth.clientId} às ${time}`,
        result.meta.last_row_id,
        String(auth.clientId),
        finalBarberId
      ).run().catch(() => {})

      sendConfirmationEmail(env, {
        reservationId: result.meta.last_row_id,
        clientId:      auth.clientId,
        barberName:    barber.nome,
        serviceName:   service.nome,
        dataHora,
      }).catch(console.error)

      return created({ id: result.meta.last_row_id, barber_id: finalBarberId, barber_name: barber.nome })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}

/**
 * Escolhe o melhor barbeiro disponível para um slot:
 * a) menos reservas hoje
 * b) menos reservas ontem
 * c) aleatório
 */
async function pickBarber(env, date, time, duration) {
  const dataHora   = `${date}T${time}:00`
  const dateObj    = new Date(date)
  const yesterday  = new Date(dateObj)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  // Todos os barbeiros activos
  const { results: barbers } = await env.DB.prepare(
    'SELECT id FROM barbeiros WHERE ativo = 1'
  ).all()
  if (!barbers.length) return null

  // Filtrar os que estão disponíveis no slot
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

  // Contagem de reservas hoje
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

  // Contagem de reservas ontem
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

  // Aleatório
  return afterYest[Math.floor(Math.random() * afterYest.length)].id
}

async function sendConfirmationEmail(env, { reservationId, clientId, barberName, serviceName, dataHora }) {
  if (!env.RESEND_API_KEY) return
  const client = await env.DB.prepare(
    'SELECT nome, email FROM clientes WHERE id = ?'
  ).bind(clientId).first()
  if (!client?.email) return

  const dt      = new Date(dataHora)
  const dateStr = dt.toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeStr = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from:    'Barbearia <noreply@brooklynbarbearia.pt>',
      to:      client.email,
      subject: `Reserva #${reservationId} confirmada`,
      html: `<p>Olá <strong>${client.nome}</strong>,</p>
             <p><strong>Serviço:</strong> ${serviceName}<br>
             <strong>Barbeiro:</strong> ${barberName}<br>
             <strong>Data:</strong> ${dateStr} às ${timeStr}</p>`,
    }),
  })
}
