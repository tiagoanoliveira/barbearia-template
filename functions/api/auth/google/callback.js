import { signJWT } from '../../../utils/jwt.js'
import { serverError, badRequest } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

/**
 * GET /api/auth/google/callback?code=...&state=...
 * Recebe o authorization code da Google, troca por tokens,
 * obtém o perfil do utilizador, cria ou actualiza o registo em `clientes`,
 * emite o nosso próprio JWT e redireciona para o destino original.
 *
 * Quando um cliente NOVO é criado (sem telefone), o redirect inclui
 * needs_phone=1 para que o frontend peça o contacto antes de continuar.
 */
export async function onRequest(context) {
  const { request, env } = context

  try {
    const url   = new URL(request.url)
    const code  = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error || !code) {
      return Response.redirect(`${url.origin}/login?error=google_cancelled`, 302)
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
    } catch { /* state inválido — usar default */ }

    if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
      return serverError('Google OAuth não configurado')
    }

    const callbackUrl = `${url.origin}/api/auth/google/callback`

    // 1. Trocar code por access_token + id_token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  callbackUrl,
        grant_type:    'authorization_code',
      }),
    })

    if (!tokenRes.ok) {
      const errBody = await tokenRes.text()
      console.error('Google token exchange failed:', errBody)
      return Response.redirect(`${url.origin}/login?error=google_token`, 302)
    }

    const tokens = await tokenRes.json()

    // 2. Obter perfil via userinfo endpoint
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    })

    if (!profileRes.ok) {
      return Response.redirect(`${url.origin}/login?error=google_profile`, 302)
    }

    const profile = await profileRes.json()

    if (!profile.email) {
      return Response.redirect(`${url.origin}/login?error=google_no_email`, 302)
    }

    const email    = profile.email.toLowerCase()
    const googleId = profile.sub
    const nome     = sanitize(profile.name ?? email.split('@')[0], 100)
    const fotoUrl  = profile.picture ?? null

    // ── Modo LINK: associar a conta já autenticada, sem criar nova ───────────
    if (linkMode) {
      if (!linkClientId) {
        return badRequest('Ligação social inválida')
      }

      const existing = await env.DB.prepare(
        'SELECT id, email, auth_methods, foto_perfil FROM clientes WHERE id = ?'
      ).bind(linkClientId).first()

      if (!existing) {
        return badRequest('Conta de cliente não encontrada para associação Google')
      }

      const storedEmail = (existing.email ?? '').toLowerCase()
      if (storedEmail && storedEmail !== email) {
        const dest = new URL(redirectTo, url.origin)
        dest.searchParams.set('social_error', 'google_email_mismatch')
        return Response.redirect(dest.toString(), 302)
      }

      const methods    = existing.auth_methods ?? 'password'
      const newMethods = methods.includes('google') ? methods : `${methods},google`

      await env.DB.prepare(
        `UPDATE clientes
           SET google_id = ?, foto_perfil = COALESCE(foto_perfil, ?),
               auth_methods = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(googleId, fotoUrl, newMethods, existing.id).run()

      const jwt = await signJWT(
        { id: existing.id, email: existing.email ?? email },
        env.JWT_SECRET
      )

      return Response.redirect(
        `${url.origin}/auth/callback?token=${encodeURIComponent(jwt)}&redirect=${encodeURIComponent(redirectTo)}`,
        302
      )
    }

    // ── Modo LOGIN normal ───────────────────────────────────────────────────

    // 3. Procurar cliente existente por google_id ou email
    let client = await env.DB.prepare(
      'SELECT id, nome, email, telefone, foto_perfil, auth_methods FROM clientes WHERE google_id = ?'
    ).bind(googleId).first()

    if (!client) {
      client = await env.DB.prepare(
        'SELECT id, nome, email, telefone, foto_perfil, auth_methods FROM clientes WHERE email = ?'
      ).bind(email).first()
    }

    let isNewClient = false

    if (client) {
      // 4a. Cliente já existe — actualizar google_id, foto e auth_methods
      const methods    = client.auth_methods ?? 'password'
      const newMethods = methods.includes('google') ? methods : `${methods},google`

      await env.DB.prepare(
        `UPDATE clientes
         SET google_id = ?, foto_perfil = COALESCE(foto_perfil, ?),
             auth_methods = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(googleId, fotoUrl, newMethods, client.id).run()

    } else {
      // 4b. Novo cliente — criar registo (sem telefone)
      const result = await env.DB.prepare(
        `INSERT INTO clientes (nome, email, google_id, foto_perfil, auth_methods,
                               password_hash, email_verificado)
         VALUES (?, ?, ?, ?, 'google', '', 1)`
      ).bind(nome, email, googleId, fotoUrl).run()

      client = { id: result.meta.last_row_id, nome, email, telefone: null, foto_perfil: fotoUrl }
      isNewClient = true
    }

    // 5. Emitir JWT próprio
    const jwt = await signJWT(
      { id: client.id, email: client.email ?? email },
      env.JWT_SECRET
    )

    // 6. Se cliente novo (sem telefone) — sinalizar ao frontend para pedir contacto
    const needsPhone = isNewClient || !client.telefone

    const params = new URLSearchParams({
      token:    jwt,
      redirect: redirectTo,
    })
    if (needsPhone) params.set('needs_phone', '1')

    return Response.redirect(
      `${url.origin}/auth/callback?${params.toString()}`,
      302
    )

  } catch (e) {
    console.error('Google OAuth callback error:', e)
    return Response.redirect(
      `${new URL(request.url).origin}/login?error=google_internal`,
      302
    )
  }
}
