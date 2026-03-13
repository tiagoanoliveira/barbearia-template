/**
 * Core logic: calcular slots livres para um barbeiro, data e serviço
 * Reutilizável por qualquer rota
 */

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

  return allSlots.filter(slot => {
    const slotStart = new Date(`${date}T${slot}:00`)
    const slotEnd   = addMinutes(slotStart, serviceDuration)

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

export function getOpenClose(dayOfWeek) {
  if (dayOfWeek === 0) return null                  // Domingo: fechado
  if (dayOfWeek === 6) return { open: 9, close: 18 } // Sábado
  return { open: 10, close: 20 }                    // Seg-Sex
}
