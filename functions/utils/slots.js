/**
 * Core logic: calcular slots livres para um barbeiro, data e serviço
 * Reutilizável por qualquer rota
 */
import { getNowLisboa } from './time.js'
import { WORKING_HOURS } from './site-config.js'

export function computeSlots({
  date,
  serviceDuration,
  existingReservations,
  unavailabilities,
  openHour,
  closeHour,
  intervalMinutes = 60,
}) {
  // Gerar todos os slots do dia
  const allSlots = []
  for (let h = openHour; h < closeHour; h += intervalMinutes / 60) {
    const hh = Math.floor(h).toString().padStart(2, '0')
    const mm = ((h % 1) * 60).toString().padStart(2, '0')
    allSlots.push(`${hh}:${mm}`)
  }

  // Pré-processar reservas em intervalos
  const bookedIntervals = existingReservations.map(r => ({
    start: parseDateTime(r.data_hora),
    end:   addMinutes(parseDateTime(r.data_hora), r.duracao_minutos || 60),
  }))

  // Pré-processar indisponibilidades
  const unavailIntervals = unavailabilities.map(u => {
    if (u.is_all_day) return {
      start: new Date(`${date}T00:00:00`),
      end:   new Date(`${date}T23:59:59`),
    }
    return {
      start: parseDateTime(u.data_hora_inicio),
      end:   parseDateTime(u.data_hora_fim),
    }
  })

  const closeDate = new Date(`${date}T${closeHour.toString().padStart(2, '0')}:00:00`)
  // Usa hora de Lisboa para respeitar DST (hora de verão/inverno)
  const now = getNowLisboa()

  return allSlots.filter(slot => {
    const slotStart = new Date(`${date}T${slot}:00`)
    const slotEnd   = addMinutes(slotStart, serviceDuration)

    // Filtrar slots de horas passadas (incluindo slots do dia atual já ultrapassados)
    if (slotStart <= now) return false

    // Não ultrapassar horário de fecho
    if (slotEnd > closeDate) return false

    // Sem conflito com reservas
    if (bookedIntervals.some(i => overlaps(slotStart, slotEnd, i.start, i.end))) return false

    // Sem conflito com indisponibilidades
    if (unavailIntervals.some(i => overlaps(slotStart, slotEnd, i.start, i.end))) return false

    return true
  })
}

function overlaps(a1, a2, b1, b2) {
  return a1.getTime() < b2.getTime() && b1.getTime() < a2.getTime()
}

function addMinutes(date, mins) {
  return new Date(date.getTime() + mins * 60_000)
}

function parseDateTime(str) {
  return new Date(str.includes('T') ? str : str.replace(' ', 'T'))
}

/**
 * Devolve { open, close } para o dia da semana indicado (0=Dom, 6=Sáb),
 * ou null se a barbearia estiver fechada nesse dia.
 * Lido a partir de WORKING_HOURS em site-config.js.
 */
export function getOpenClose(dayOfWeek) {
  const day = WORKING_HOURS[dayOfWeek]
  if (!day || day.closed) return null
  return { open: day.open, close: day.close }
}
