/**
 * webpush.js — envia Web Push notifications via VAPID (sem dependências externas)
 *
 * Implementa RFC 8291 (encriptação) + RFC 8292 (VAPID) + RFC 8188 (aes128gcm).
 */

function b64uToBytes(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const raw = atob(b64 + pad)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function bytesToB64u(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

async function makeVapidJWT(audience, subject, privateKey) {
  const now    = Math.floor(Date.now() / 1000)
  const header = { typ: 'JWT', alg: 'ES256' }
  const claims = { aud: audience, exp: now + 43200, sub: subject }

  const enc    = new TextEncoder()
  const h64    = bytesToB64u(enc.encode(JSON.stringify(header)))
  const c64    = bytesToB64u(enc.encode(JSON.stringify(claims)))
  const signing = `${h64}.${c64}`

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    enc.encode(signing),
  )

  return `${signing}.${bytesToB64u(sig)}`
}

async function importVapidPrivateKey(privB64u, pubB64u) {
  const pub  = b64uToBytes(pubB64u)
  const priv = b64uToBytes(privB64u)

  return crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC', crv: 'P-256',
      x: bytesToB64u(pub.slice(1, 33)),
      y: bytesToB64u(pub.slice(33, 65)),
      d: bytesToB64u(priv),
      key_ops: ['sign'],
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
}

function concat(...arrays) {
  const total  = arrays.reduce((n, a) => n + a.length, 0)
  const result = new Uint8Array(total)
  let offset   = 0
  for (const a of arrays) { result.set(a, offset); offset += a.length }
  return result
}

async function hkdf(ikm, salt, info, len) {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  return new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, key, len * 8)
  )
}

async function encryptPayload(plaintext, p256dhB64u, authB64u) {
  const enc        = new TextEncoder()
  const clientPub  = b64uToBytes(p256dhB64u)
  const authSecret = b64uToBytes(authB64u)

  const serverKP = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey', 'deriveBits']
  )
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', serverKP.publicKey))

  const clientPubKey = await crypto.subtle.importKey(
    'raw', clientPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []
  )

  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, serverKP.privateKey, 256)
  )

  const salt = crypto.getRandomValues(new Uint8Array(16))

  const webpushInfo = concat(
    enc.encode('WebPush: info'),
    new Uint8Array([0x00]),
    clientPub,
    serverPubRaw,
  )

  const ikm = await hkdf(sharedBits, authSecret, webpushInfo, 32)

  const contentKey = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce      = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12)

  const aesKey = await crypto.subtle.importKey('raw', contentKey, 'AES-GCM', false, ['encrypt'])

  const padded = concat(plaintext, new Uint8Array([0x02]))
  const cipher = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, padded)
  )

  const rsBytes = new Uint8Array(4)
  new DataView(rsBytes.buffer).setUint32(0, 4096, false)
  const header = concat(salt, rsBytes, new Uint8Array([serverPubRaw.length]), serverPubRaw)

  return concat(header, cipher)
}

/**
 * Envia uma Web Push notification para uma subscrição com payload encriptado.
 */
export async function sendWebPush(subscription, payload, vapid) {
  const { endpoint, keys: { p256dh, auth } } = subscription
  const origin   = new URL(endpoint)
  const audience = `${origin.protocol}//${origin.host}`

  const privateKey = await importVapidPrivateKey(vapid.privateKey, vapid.publicKey)
  const jwt        = await makeVapidJWT(audience, vapid.subject, privateKey)

  const body    = new TextEncoder().encode(JSON.stringify(payload))
  const encrypt = await encryptPayload(body, p256dh, auth)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization':    `vapid t=${jwt},k=${vapid.publicKey}`,
      'Content-Type':     'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL':              '86400',
    },
    body: encrypt,
  })

  const resBody = await res.text().catch(() => '')
  return { status: res.status, statusText: res.statusText, body: resBody }
}

/**
 * Envia push a todos os admins/barbeiros relevantes.
 */
export async function sendPushToBarbers(db, notification, env) {
  const pub     = env.VAPID_PUBLIC_KEY
  const priv    = env.VAPID_PRIVATE_KEY
  const subject = env.VAPID_SUBJECT ?? 'mailto:admin@barbearia.pt'

  if (!pub || !priv) {
    console.error('[webpush] VAPID_PUBLIC_KEY ou VAPID_PRIVATE_KEY não configurados')
    return []
  }

  try {
    let stmt, params
    if (notification.barber_id) {
      stmt   = `SELECT ps.endpoint, ps.p256dh, ps.auth
                FROM push_subscriptions ps
                JOIN admin_users au ON au.id = ps.admin_user_id
                WHERE au.barbeiro_id = ? AND au.ativo = 1`
      params = [notification.barber_id]
    } else {
      stmt   = `SELECT ps.endpoint, ps.p256dh, ps.auth
                FROM push_subscriptions ps
                JOIN admin_users au ON au.id = ps.admin_user_id
                WHERE au.ativo = 1`
      params = []
    }

    const { results: subs } = await db.prepare(stmt).bind(...params).all()
    if (!subs.length) return []

    const vapid = { publicKey: pub, privateKey: priv, subject }
    const msg   = {
      title:           'Barbearia',
      body:            notification.message,
      url:             '/admin/dashboard',
      notification_id: notification.notification_id ?? null,
    }

    const results = await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const result = await sendWebPush(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            msg,
            vapid
          )
          if (result.status === 410 || result.status === 404) {
            await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
              .bind(s.endpoint).run().catch(() => {})
          } else if (result.status !== 201 && result.status !== 200) {
            console.error(`[webpush] Push falhou (${result.status}) → ${s.endpoint.slice(-40)} | ${result.body}`)
          }
          return { endpoint: s.endpoint, status: result.status }
        } catch (err) {
          console.error('[webpush] Erro ao enviar push:', err?.message)
          return { endpoint: s.endpoint, status: 0, error: err?.message }
        }
      })
    )

    return results.map(r => r.status === 'fulfilled' ? r.value : { status: 0, error: r.reason?.message })
  } catch (err) {
    console.error('[webpush] Erro em sendPushToBarbers:', err?.message)
    return []
  }
}
