import { ok, badRequest, notFound, serverError, corsOptions } from '../utils/response.js'
import { isValidDate, isValidId } from '../utils/validators.js'
import { computeSlots, getOpenClose } from '../utils/slots.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const url       = new URL(request.url)
  const date      = url.searchParams.get('date')       || url.searchParams.get('data')
  const barberId  = url.searchParams.get('barber_id')  || url.searchParams.get('barbeiro')
  const serviceId = url.searchParams.get('service_id') || url.searchParams.get('servico')

  if (!isValidDate(date))     return badRequest('Data inválida (formato: YYYY-MM-DD)')
  if (!isValidId(barberId))   return badRequest('ID do barbeiro inválido')
  if (!isValidId(serviceId))  return badRequest('ID do serviço inválido')

  try {
    const dayOfWeek = new Date(date).getDay()
    const hours     = getOpenClose(dayOfWeek)
    if (!hours) return ok([]) // Domingo — fechado

    const [service, { results: reservations }, { results: unavailabilities }] = await Promise.all([
      env.DB.prepare('SELECT id, duracao FROM servicos WHERE id = ?').bind(serviceId).first(),

      // Usar v_reservas_duracao (existe no schema original)
      env.DB.prepare(`
        SELECT data_hora, duracao_minutos
        FROM v_reservas_duracao
        WHERE barbeiro_id = ?
          AND date(data_hora) = ?
          AND status IN ('confirmada', 'faltou', 'concluida')
      `).bind(barberId, date).all(),

      env.DB.prepare(`
        SELECT data_hora_inicio, data_hora_fim, is_all_day
        FROM horarios_indisponiveis
        WHERE barbeiro_id = ?
          AND date(data_hora_inicio) <= ?
          AND date(data_hora_fim)    >= ?
      `).bind(barberId, date, date).all(),
    ])

    if (!service) return notFound('Serviço não encontrado')

    const slots = computeSlots({
      date,
      serviceDuration:      service.duracao || 60,
      existingReservations: reservations,
      unavailabilities,
      openHour:  hours.open,
      closeHour: hours.close,
    })

    return ok(slots)
  } catch (e) {
    return serverError('Erro ao calcular horários', e.message)
  }
}
