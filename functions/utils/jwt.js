/**
 * JWT utilities — Web Crypto API (Edge compatible)
 */

export async function signJWT(payload, secret, expiresInSeconds = 86400 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const now    = Math.floor(Date.now() / 1000)
  const claims = { ...payload, iat: now, exp: now + expiresInSeconds }

  const encode = (obj) =>
    btoa(JSON.stringify(obj))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  const headerB64  = encode(header)
  const payloadB64 = encode(claims)
  const sigInput   = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sigInput))

  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${sigInput}.${sigB64}`
}

export async function verifyJWT(token, secret) {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Token inválido')

  const [headerB64, payloadB64, sigB64] = parts
  const sigInput = `${headerB64}.${payloadB64}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  )

  const decode64 = (s) => Uint8Array.from(
    atob(s.replace(/-/g, '+').replace(/_/g, '/')),
    (c) => c.charCodeAt(0)
  )

  const valid = await crypto.subtle.verify(
    'HMAC', key,
    decode64(sigB64),
    new TextEncoder().encode(sigInput)
  )

  if (!valid) throw new Error('Assinatura inválida')

  const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado')
  }

  return payload
}
