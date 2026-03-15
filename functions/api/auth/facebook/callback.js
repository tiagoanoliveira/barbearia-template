import { signJWT } from '../../../utils/jwt.js'
import { serverError, badRequest } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

/**
 * GET /api/auth/facebook/callback?code=...&state=...
 * Troca o code por access_token, obtém o perfil,
 * cria/actualiza registo em `clientes` e emite JWT próprio.
 */
export async function onRequest(context) {
  const { request, env } = context

  try {
    const url   = new URL(request.url)
    const code  = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error || !code) {
      return Response.redirect(`${url.origin}/login?error=facebook_cancelled`, 302)
    }

    let redirectTo = '/perfil'
    let linkMode = false
    let linkClientId = null
    try {
      const parsed = JSON.parse(atob(state ?? ''))
      if (parsed.redirect) redirectTo = parsed.redirect
      if (parsed.link) {
        linkMode     = true
        linkClientId = parsed.clientId ?? null
      }
    } catch {
      // state inválido — usar default
    }

    if (!env.FACEBOOK_CLIENT_ID || !env.FACEBOOK_CLIENT_SECRET) {
      return serverError('Facebook OAuth não configurado')
    }

    const callbackUrl = `${url.origin}/api/auth/facebook/callback`

    // 1. Trocar code por access_token
    const tokenUrl = new URL('https://graph.facebook.com/v17.0/oauth/access_token')
    tokenUrl.search = new URLSearchParams({
      client_id:     env.FACEBOOK_CLIENT_ID,
      client_secret: env.FACEBOOK_CLIENT_SECRET,
      redirect_uri:  callbackUrl,
      code,
    }).toString()

    const tokenRes = await fetch(tokenUrl.toString(), { method: 'GET' })
    if (!tokenRes.ok) {
      const body = await tokenRes.text()
      console.error('Facebook token exchange failed:', body)
      return Response.redirect(`${url.origin}/login?error=facebook_token`, 302)
    }

    const tokens = await tokenRes.json()

    // 2. Obter perfil básico
    const profileUrl = new URL('https://graph.facebook.com/me')
    profileUrl.search = new URLSearchParams({
      fields: 'id,name,email,picture',
      access_token: tokens.access_token,
    }).toString()

    const profileRes = await fetch(profileUrl.toString(), { method: 'GET' })
    if (!profileRes.ok) {
      return Response.redirect(`${url.origin}/login?error=facebook_profile`, 302)
    }

    const profile = await profileRes.json()
    if (!profile.email) {
      return Response.redirect(`${url.origin}/login?error=facebook_no_email`, 302)
    }

    const email      = String(profile.email).toLowerCase()
    const facebookId = String(profile.id)
    const nome       = sanitize(profile.name ?? email.split('@')[0], 100)
    const fotoUrl    = profile.picture?.data?.url ?? null

    // ── Modo LINK: associar a conta já autenticada, sem criar nova ───────────
    if (linkMode) {
      if (!linkClientId) {
        return badRequest('Ligação social inválida')
      }

      const existing = await env.DB.prepare(
        'SELECT id, email, auth_methods, foto_perfil FROM clientes WHERE id = ?'
      ).bind(linkClientId).first()

      if (!existing) {
        return serverError('Conta de cliente não encontrada para associação Facebook')
      }

      const storedEmail = (existing.email ?? '').toLowerCase()
      if (storedEmail && storedEmail !== email) {
        const dest = new URL(redirectTo, url.origin)
        dest.searchParams.set('social_error', 'facebook_email_mismatch')
        return Response.redirect(dest.toString(), 302)
      }

      const methods    = existing.auth_methods ?? 'password'
      const newMethods = methods.includes('facebook') ? methods : `${methods},facebook`

      await env.DB.prepare(
        `UPDATE clientes
           SET facebook_id = ?, foto_perfil = COALESCE(foto_perfil, ?),
               auth_methods = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(facebookId, fotoUrl, newMethods, existing.id).run()

      const jwt = await signJWT(
        { id: existing.id, email: existing.email ?? email },
        env.JWT_SECRET
      )

      return Response.redirect(
        `${url.origin}/auth/callback?token=${encodeURIComponent(jwt)}&redirect=${encodeURIComponent(redirectTo)}`,
        302
      )
    }

    // ── Modo LOGIN normal: comportamento anterior ───────────────────────────

    // 3. Procurar cliente existente por facebook_id ou email
    let client = await env.DB.prepare(
      'SELECT id, nome, email, foto_perfil, auth_methods FROM clientes WHERE facebook_id = ?'
    ).bind(facebookId).first()

    if (!client) {
      client = await env.DB.prepare(
        'SELECT id, nome, email, foto_perfil, auth_methods FROM clientes WHERE email = ?'
      ).bind(email).first()
    }

    if (client) {
      const methods    = client.auth_methods ?? 'password'
      const newMethods = methods.includes('facebook') ? methods : `${methods},facebook`

      await env.DB.prepare(
        `UPDATE clientes
           SET facebook_id = ?, foto_perfil = COALESCE(foto_perfil, ?),
               auth_methods = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(facebookId, fotoUrl, newMethods, client.id).run()
    } else {
      const result = await env.DB.prepare(
        `INSERT INTO clientes (nome, email, facebook_id, foto_perfil, auth_methods,
                               password_hash, email_verificado)
         VALUES (?, ?, ?, ?, 'facebook', '', 1)`
      ).bind(nome, email, facebookId, fotoUrl).run()

      client = { id: result.meta.last_row_id, nome, email, foto_perfil: fotoUrl }
    }

    const jwt = await signJWT(
      { id: client.id, email: client.email ?? email },
      env.JWT_SECRET
    )

    return Response.redirect(
      `${url.origin}/auth/callback?token=${encodeURIComponent(jwt)}&redirect=${encodeURIComponent(redirectTo)}`,
      302
    )
  } catch (e) {
    console.error('Facebook OAuth callback error:', e)
    return Response.redirect(
      `${new URL(request.url).origin}/login?error=facebook_internal`,
      302
    )
  }
}
