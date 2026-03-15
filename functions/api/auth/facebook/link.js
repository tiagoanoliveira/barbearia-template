import { corsOptions, serverError } from '../../../utils/response.js'
import { authenticateClient } from '../../../utils/auth.js'

/**
 * GET /api/auth/facebook/link?redirect=/perfil
 * Inicia o fluxo OAuth 2.0 do Facebook em modo de associação de conta.
 * Requer cliente autenticado (user_token).
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  try {
    const auth = await authenticateClient(request, env)
    if (!auth.success) {
      return new Response(JSON.stringify({ success: false, error: 'Precisas de iniciar sessão para associar a conta Facebook.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const url      = new URL(request.url)
    const redirect = url.searchParams.get('redirect') ?? '/perfil'

    if (!env.FACEBOOK_CLIENT_ID) {
      return serverError('Facebook OAuth não configurado')
    }

    const state = btoa(JSON.stringify({
      redirect,
      ts: Date.now(),
      link: true,
      clientId: auth.clientId,
      clientEmail: auth.email,
    }))

    const origin      = url.origin
    const callbackUrl = `${origin}/api/auth/facebook/callback`

    const params = new URLSearchParams({
      client_id:     env.FACEBOOK_CLIENT_ID,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'public_profile,email',
      state,
    })

    const oauthUrl = `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`

    return new Response(JSON.stringify({ success: true, data: { url: oauthUrl } }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return serverError('Erro ao iniciar OAuth (link Facebook)', e.message)
  }
}
