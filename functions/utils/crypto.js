/**
 * Password hashing with PBKDF2 — Web Crypto API
 * Compatível com hashes antigos SHA-256 + salt do site anterior.
 */

export async function hashPassword(password) {
  const salt    = crypto.getRandomValues(new Uint8Array(16))
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'PBKDF2' }, false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    key, 256
  )
  const hashHex = Array.from(new Uint8Array(bits))
    .map(b => b.toString(16).padStart(2, '0')).join('')

  return `${saltHex}:${hashHex}`
}

export async function verifyPassword(password, stored) {
  const [saltHex, storedHash] = (stored ?? '').split(':')
  if (!saltHex || !storedHash) return false

  const saltBytes = Uint8Array.from((saltHex.match(/.{2}/g) ?? []).map(h => parseInt(h, 16)))

  // 1) Tentativa PBKDF2 (novo esquema)
  try {
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password),
      { name: 'PBKDF2' }, false, ['deriveBits']
    )
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
      key, 256
    )
    const hashHex = Array.from(new Uint8Array(bits))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    if (hashHex === storedHash) return true
  } catch {
    // Ignorar e tentar modo legacy
  }

  // 2) Compatibilidade LEGACY: SHA-256(saltHex + password)
  try {
    const data   = new TextEncoder().encode(saltHex + password)
    const digest = await crypto.subtle.digest('SHA-256', data)
    const legacyHex = Array.from(new Uint8Array(digest))
      .map(b => b.toString(16).padStart(2, '0')).join('')

    return legacyHex === storedHash
  } catch {
    return false
  }
}
