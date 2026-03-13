export const isValidDate = (d) =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(new Date(d).getTime())

export const isValidTime = (t) =>
  typeof t === 'string' && /^([01]\d|2[0-3]):([0-5]\d)$/.test(t)

export const isValidId = (id) => {
  const n = parseInt(id)
  return !isNaN(n) && n > 0
}

export const sanitize = (str, maxLen = 500) =>
  typeof str === 'string' ? str.trim().substring(0, maxLen) : ''
