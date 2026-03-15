import { corsOptions, serverError } from '../../../utils/response.js'
import { authenticateClient } from '../../../utils/auth.js'

/**
 * GET /api/auth/google/link?redirect=/perfil
 * Inicia o fluxo OAuth 2.0 da Google em modo de associação de conta.
 * Requer cliente autenticado (user_token).
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  try {
    const auth = await authenticateClient(request, env)
    if (!auth.success) {
      return new Response(JSON.stringify({ success: false, error: 'Precisas de iniciar sessão para associar a conta Google.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url      = new URL(request.url)
    const redirect = url.searchParams.get('redirect') ?? '/perfil'

    if (!env.GOOGLE_CLIENT_ID) {
      return serverError('Google OAuth não configurado')
    }

    const state = btoa(JSON.stringify({
      redirect,
      ts: Date.now(),
      link: true,
      clientId: auth.clientId,
      clientEmail: auth.email,
    }))

    const origin      = url.origin
    const callbackUrl = `${origin}/api/auth/google/callback`

    const params = new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      state,
      prompt:        'select_account',
    })

    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`

    return new Response(JSON.stringify({ success: true, data: { url: oauthUrl } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return serverError('Erro ao iniciar OAuth (link Google)', e.message)
  }
}
