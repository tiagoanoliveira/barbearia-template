/**
 * Utilitários de criptografia
 * - hashPassword / verifyPassword com PBKDF2 + fallback legacy SHA-256
 * - generateToken: token hex aleatório (síncrono via crypto.getRandomValues)
 */

// ─── PBKDF2 helpers ───────────────────────────────────────────────────────────
function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function pbkdf2Hash(password, saltHex) {
  const enc      = new TextEncoder()
  const keyMat   = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits     = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(saltHex), iterations: 100000, hash: 'SHA-256' },
    keyMat, 256
  )
  return bufToHex(bits)
}

// ─── Legacy SHA-256 (site antigo) ─────────────────────────────────────────────────
async function legacySha256Hash(password, saltHex) {
  const enc  = new TextEncoder()
  const buf  = await crypto.subtle.digest('SHA-256', enc.encode(saltHex + password))
  return bufToHex(buf)
}

// ─── Exports ─────────────────────────────────────────────────────────────────────
export async function hashPassword(password) {
  const saltBuf = new Uint8Array(16)
  crypto.getRandomValues(saltBuf)
  const saltHex = bufToHex(saltBuf.buffer)
  const hash    = await pbkdf2Hash(password, saltHex)
  return `${saltHex}:${hash}`
}

export async function verifyPassword(password, stored) {
  if (!stored || !password) return false
  const [saltHex, storedHash] = stored.split(':')
  if (!saltHex || !storedHash) return false

  // Tentar PBKDF2 primeiro (novo esquema)
  const pbkdf2 = await pbkdf2Hash(password, saltHex)
  if (pbkdf2 === storedHash) return true

  // Fallback: esquema legacy SHA-256(saltHex + password)
  const legacy = await legacySha256Hash(password, saltHex)
  return legacy === storedHash
}

/**
 * Gera um token hex aleatório de 32 bytes (64 caracteres).
 * Síncrono — não precisa de await.
 */
export function generateToken() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return bufToHex(buf.buffer)
}
