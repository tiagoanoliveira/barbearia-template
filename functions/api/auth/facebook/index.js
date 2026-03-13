import { corsOptions, serverError } from '../../../utils/response.js'

/**
 * GET /api/auth/facebook?redirect=/perfil
 * Inicia o fluxo OAuth 2.0 com o Facebook.
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  try {
    const url      = new URL(request.url)
    const redirect = url.searchParams.get('redirect') ?? '/perfil'

    if (!env.FACEBOOK_CLIENT_ID) {
      return serverError('Facebook OAuth não configurado')
    }

    const state = btoa(JSON.stringify({ redirect, ts: Date.now() }))

    const origin      = url.origin
    const callbackUrl = `${origin}/api/auth/facebook/callback`

    const params = new URLSearchParams({
      client_id:     env.FACEBOOK_CLIENT_ID,
      redirect_uri:  callbackUrl,
      response_type: 'code',
      scope:         'public_profile,email',
      state,
    })

    return Response.redirect(
      `https://www.facebook.com/v17.0/dialog/oauth?${params.toString()}`,
      302
    )
  } catch (e) {
    return serverError('Erro ao iniciar OAuth do Facebook', e.message)
  }
}
