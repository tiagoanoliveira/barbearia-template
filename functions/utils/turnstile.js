/**
 * Helper para verificação do Cloudflare Turnstile.
 *
 * A verificação só é aplicada quando existe TURNSTILE_SECRET_KEY nas
 * variáveis de ambiente. Em ambientes de desenvolvimento sem esta key,
 * a função devolve sempre success: true.
 */

export async function verifyTurnstile(context, token) {
  const { env, request } = context

  // Se não houver secret configurada, não bloqueia nada (ex: desenvolvimento)
  const secret = env?.TURNSTILE_SECRET_KEY
  if (!secret) {
    return { success: true }
  }

  if (!token || typeof token !== 'string') {
    return { success: false, error: 'missing-token' }
  }

  const ip = request.headers.get('CF-Connecting-IP') ?? ''

  try {
    const body = new URLSearchParams()
    body.append('secret', secret)
    body.append('response', token)
    if (ip) body.append('remoteip', ip)

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    })

    const data = await res.json()

    if (!data.success) {
      console.warn('[turnstile] Falha na verificação:', data['error-codes'] || data)
      return { success: false, error: data['error-codes']?.[0] ?? 'verification-failed' }
    }

    return { success: true }
  } catch (err) {
    console.error('[turnstile] Erro ao chamar API:', err)
    // Em caso de erro de rede/timeout, falhar em modo seguro (bloquear pedido)
    return { success: false, error: 'verification-error' }
  }
}
