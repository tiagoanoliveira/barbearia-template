const EMPTY_BRACKET_COMMENT_PATTERN = /^\[\s*\]$/

export function hasMeaningfulReservationComment(comment?: string) {
  if (!comment) return false
  const trimmed = comment.trim()
  if (!trimmed) return false
  return !EMPTY_BRACKET_COMMENT_PATTERN.test(trimmed)
}
