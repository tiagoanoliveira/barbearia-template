import { authenticateClient } from '../utils/auth.js'
import {
  ok, created, badRequest, unauthorized, notFound,
  conflict, serverError, corsOptions
} from '../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../utils/validators.js'
import { sendReservationConfirmation } from '../utils/reservationEmails.js'
import { getNowLisboa } from '../utils/time.js'
import { computeSlots, getOpenClose } from '../utils/slots.js'

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

      const client = await env.DB.prepare(
        'SELECT nome, email FROM clientes WHERE id = ?'
      ).bind(auth.clientId).first()

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
          `Nova reserva: ${client?.nome ?? 'Cliente'} — ${service?.nome}, ${date} às ${time}`,
          reservationId,
          client?.nome,
          finalBarberId
      ).run().catch(() => {})

      // Envia email de confirmação e agenda lembrete 24h antes (em background)
      sendReservationConfirmation(context, {
        reservaId:   reservationId,
        clientEmail: client?.email ?? null,
        clientName:  client?.nome  ?? 'Cliente',
        dataHora,
        serviceName: service.nome,
        barberName:  barber.nome,
        duracao:     service.duracao || 60,
        comentario:  notes ?? '',
      })

      return created({ id: reservationId, barber_id: finalBarberId, barber_name: barber.nome })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}

/**
 * Seleciona o barbeiro disponível com menos reservas no dia para o slot pedido.
 *
 * Algoritmo:
 *  1. Obter todos os barbeiros activos
 *  2. Para cada um, calcular os slots disponíveis via computeSlots
 *     (verifica reservas existentes E indisponibilidades parciais/all-day)
 *  3. Filtrar os que TÊM o slot pedido disponível
 *  4. Ordenar por nº de reservas no dia (crescente)
 *  5. Em caso de empate, usar o dia anterior como desempate
 *  6. Em caso de empate persistente, aleatorizar
 */
async function pickBarber(env, date, time, duration) {
  const dayOfWeek = new Date(date).getDay()
  const hours     = getOpenClose(dayOfWeek)
  if (!hours) return null  // barbearia fechada nesse dia

  const { results: barbers } = await env.DB.prepare(
    'SELECT id FROM barbeiros WHERE ativo = 1'
  ).all()
  if (!barbers.length) return null

  // Para cada barbeiro, verificar se o slot específico está disponível
  // usando computeSlots — mesma lógica de /api/slots e /api/slots-any-barber
  const candidates = []
  await Promise.all(barbers.map(async b => {
    const [{ results: reservations }, { results: unavailabilities }] = await Promise.all([
      env.DB.prepare(
        `SELECT data_hora, duracao_minutos FROM v_reservas_duracao
         WHERE barbeiro_id = ? AND date(data_hora) = ?
         AND status IN ('confirmada','faltou','concluida')`
      ).bind(b.id, date).all(),
      env.DB.prepare(
        `SELECT data_hora_inicio, data_hora_fim, is_all_day
         FROM horarios_indisponiveis
         WHERE barbeiro_id = ? AND date(data_hora_inicio) <= ? AND date(data_hora_fim) >= ?`
      ).bind(b.id, date, date).all(),
    ])

    const availableSlots = computeSlots({
      date,
      serviceDuration:      duration,
      existingReservations: reservations,
      unavailabilities,
      openHour:  hours.open,
      closeHour: hours.close,
    })

    if (availableSlots.includes(time)) {
      candidates.push({ id: b.id })
    }
  }))

  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0].id

  // Ordenar candidatos por nº de reservas no dia (crescente)
  const dateObj      = new Date(date)
  const yesterday    = new Date(dateObj)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const withTodayCounts = await Promise.all(candidates.map(async c => {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM reservas
       WHERE barbeiro_id = ? AND date(data_hora) = ?
       AND status IN ('confirmada','faltou','concluida')`
    ).bind(c.id, date).first()
    return { id: c.id, today: row?.cnt ?? 0 }
  }))

  withTodayCounts.sort((a, b) => a.today - b.today)
  const minToday  = withTodayCounts[0].today
  const tiedToday = withTodayCounts.filter(r => r.today === minToday)

  if (tiedToday.length === 1) return tiedToday[0].id

  // Desempate: barbeiro com menos reservas ontem
  const withYesterdayCounts = await Promise.all(tiedToday.map(async c => {
    const row = await env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM reservas
       WHERE barbeiro_id = ? AND date(data_hora) = ?
       AND status IN ('confirmada','faltou','concluida')`
    ).bind(c.id, yesterdayStr).first()
    return { id: c.id, yesterday: row?.cnt ?? 0 }
  }))

  withYesterdayCounts.sort((a, b) => a.yesterday - b.yesterday)
  const minYest    = withYesterdayCounts[0].yesterday
  const tiedFinal  = withYesterdayCounts.filter(r => r.yesterday === minYest)

  return tiedFinal[Math.floor(Math.random() * tiedFinal.length)].id
}
