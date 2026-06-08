/**
 * GET /api/slots-any-barber?date=YYYY-MM-DD&service_id=X
 *
 * Devolve a união dos slots disponíveis de todos os barbeiros activos,
 * para ser usada na opção "Sem preferência".
 */
import { ok, badRequest, serverError, corsOptions } from '../utils/response.js'
import { isValidDate, isValidId } from '../utils/validators.js'
import { computeSlots, getOpenClose } from '../utils/slots.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const url       = new URL(request.url)
  const date      = url.searchParams.get('date')
  const serviceId = url.searchParams.get('service_id')

  if (!isValidDate(date))    return badRequest('Data inválida')
  if (!isValidId(serviceId)) return badRequest('ID do serviço inválido')

  try {
    const dayOfWeek = new Date(date).getDay()
    const hours     = getOpenClose(dayOfWeek)
    if (!hours) return ok([]) // fechado

    const [service, { results: barbers }] = await Promise.all([
      env.DB.prepare('SELECT id, duracao FROM servicos WHERE id = ?').bind(serviceId).first(),
      env.DB.prepare('SELECT id FROM barbeiros WHERE ativo = 1').all(),
    ])

    if (!service) return badRequest('Serviço não encontrado')
    if (!barbers.length) return ok([])

    // Calcular slots para cada barbeiro e fazer a união
    const slotSets = await Promise.all(
      barbers.map(async barber => {
        const [{ results: reservations }, { results: unavailabilities }] = await Promise.all([
          env.DB.prepare(
            `SELECT data_hora, duracao_minutos FROM v_reservas_duracao
             WHERE barbeiro_id = ? AND date(data_hora) = ?
             AND status IN ('confirmada','faltou','concluida')`
          ).bind(barber.id, date).all(),
          env.DB.prepare(
            `SELECT data_hora_inicio, data_hora_fim, is_all_day
             FROM horarios_indisponiveis
             WHERE barbeiro_id = ? AND date(data_hora_inicio) <= ? AND date(data_hora_fim) >= ?`
          ).bind(barber.id, date, date).all(),
        ])

        const slots = computeSlots({
          date,
          serviceDuration:      service.duracao || 60,
          existingReservations: reservations,
          unavailabilities,
          openHour:  hours.open,
          closeHour: hours.close,
          breakStart: hours.breakStart,
          breakEnd:   hours.breakEnd,
        })
        return { barberId: barber.id, slots }
      })
    )

    // Mapa de slot -> barberIds disponíveis
    const slotMap = new Map()
    for (const { barberId, slots } of slotSets) {
      for (const s of slots) {
        if (!slotMap.has(s)) slotMap.set(s, [])
        slotMap.get(s).push(barberId)
      }
    }

    const availableSlots = [...slotMap.keys()].sort()
    return ok(availableSlots)
  } catch (e) {
    console.error('[slots-any-barber]', e)
    return serverError('Erro ao calcular slots', e.message)
  }
}
