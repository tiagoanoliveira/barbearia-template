import type { Reservation } from '@/types'

// Comentários do tipo "[]" ou "[ ]" não devem contar como comentário útil.
const EMPTY_BRACKET_PATTERN = /^\[\s*\]$/

export function hasReservationComment(comment?: string) {
  const raw = (comment ?? '').trim()
  if (!raw) return false
  return !EMPTY_BRACKET_PATTERN.test(raw)
}

export function reservationNamePrefix(reservation: Reservation) {
  const indicators: string[] = []
  if (reservation.created_by === 'online') indicators.push('@')
  if (hasReservationComment(reservation.comentario)) indicators.push('💬')
  return indicators.length ? `${indicators.join('')} ` : ''
}
