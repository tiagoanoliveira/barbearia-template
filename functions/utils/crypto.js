/**
 * funções de criptografia
 * - hashPassword / verifyPassword: PBKDF2 + SHA-256 (compatível com barbearia-brooklyn)
 * - generateToken: token hex aleatório
 *
 * ⚠️  IMPORTANTE: não alterar o algoritmo sem migrar as passwords existentes.
 *     O salt é guardado como hex mas deve ser convertido para Uint8Array (bytes binários)
 *     antes de ser passado ao PBKDF2. Usar enc.encode(saltHex) como salt é ERRADO
 *     e gera hashes incompatíveis com o site antigo.
 */

// ─── helpers ─────────────────────────────────────────────────────────────────

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Converte string hex (ex: "a3f1...") para Uint8Array de bytes binários */
function hexToBytes(hex) {
  return new Uint8Array(hex.match(/.{2}/g).map(b => parseInt(b, 16)))
}

// ─── PBKDF2 ──────────────────────────────────────────────────────────────────

async function pbkdf2Hash(password, saltBytes) {
  const enc    = new TextEncoder()
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 100000, hash: 'SHA-256' },
    keyMat, 256
  )
  return bufToHex(bits)
}

// ─── exports públicos ─────────────────────────────────────────────────────────

/**
 * Gera hash de password no formato "saltHex:hashHex".
 * Compatível com barbearia-brooklyn/functions/utils/crypto.js.
 */
export async function hashPassword(password) {
  const saltBuf = new Uint8Array(16)
  crypto.getRandomValues(saltBuf)
  const saltHex = bufToHex(saltBuf.buffer)
  const hash    = await pbkdf2Hash(password, saltBuf)   // bytes binários, não a string hex
  return `${saltHex}:${hash}`
}

/**
 * Verifica password contra hash guardado no formato "saltHex:hashHex".
 * Compatível com barbearia-brooklyn/functions/utils/crypto.js.
 */
export async function verifyPassword(password, stored) {
  if (!stored || !password) return false
  const [saltHex, storedHash] = stored.split(':')
  if (!saltHex || !storedHash) return false

  const saltBytes = hexToBytes(saltHex)          // ← bytes binários, como o site antigo
  const hash      = await pbkdf2Hash(password, saltBytes)
  return hash === storedHash
}

/**
 * Gera token hex aleatório de 32 bytes (64 caracteres).
 */
export function generateToken() {
  const buf = new Uint8Array(32)
  crypto.getRandomValues(buf)
  return bufToHex(buf.buffer)
}
