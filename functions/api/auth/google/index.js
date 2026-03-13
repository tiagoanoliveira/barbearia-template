import { corsOptions, serverError } from '../../../utils/response.js'

/**
 * GET /api/auth/google?redirect=/perfil
 * Inicia o fluxo OAuth 2.0 com Google.
 * Redireciona o browser para o ecrã de consentimento da Google.
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  try {
    const url      = new URL(request.url)
    const redirect = url.searchParams.get('redirect') ?? '/perfil'

    if (!env.GOOGLE_CLIENT_ID) {
      return serverError('Google OAuth não configurado')
    }

    // Codifica o redirect no state para recuperar no callback
    const state = btoa(JSON.stringify({ redirect, ts: Date.now() }))

    const origin       = url.origin
    const callbackUrl  = `${origin}/api/auth/google/callback`

    const params = new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'openid email profile',
      access_type:   'online',
      state,
      prompt:        'select_account',
    })

    return Response.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      302
    )
  } catch (e) {
    return serverError('Erro ao iniciar OAuth', e.message)
  }
}
