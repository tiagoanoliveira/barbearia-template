/**
 * GET /api/auth/confirm-email-change?token=...
 * Confirma a alteração de email pendente e aplica o novo email.
 */
import { corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const url   = new URL(request.url)
  const token = url.searchParams.get('token')

  const BASE_URL = 'https://brooklynbarbearia.pt' // ajusta se precisares

  if (!token) {
    return Response.redirect(`${BASE_URL}/perfil?email_change=invalid`, 302)
  }

  try {
    const row = await env.DB.prepare(
        `SELECT id, email, email_pendente, token_verificacao_expira,
              google_id, facebook_id, instagram_id, auth_methods
       FROM clientes
       WHERE token_verificacao = ? LIMIT 1`
    ).bind(token).first()

    if (!row || !row.email_pendente) {
      return Response.redirect(`${BASE_URL}/perfil?email_change=invalid`, 302)
    }

    // Expirado?
    if (!row.token_verificacao_expira || new Date(row.token_verificacao_expira) < new Date()) {
      await env.DB.prepare(
          `UPDATE clientes
         SET email_pendente = NULL,
             token_verificacao = NULL,
             token_verificacao_expira = NULL,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(row.id).run()
      return Response.redirect(`${BASE_URL}/perfil?email_change=expired`, 302)
    }

    // Novo email já em uso?
    const existing = await env.DB.prepare(
        'SELECT id FROM clientes WHERE email = ? AND id != ?'
    ).bind(row.email_pendente, row.id).first()

    if (existing) {
      await env.DB.prepare(
          `UPDATE clientes
         SET email_pendente = NULL,
             token_verificacao = NULL,
             token_verificacao_expira = NULL,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(row.id).run()
      return Response.redirect(`${BASE_URL}/perfil?email_change=taken`, 302)
    }

    // Desassociar redes sociais se existirem
    const methods = (row.auth_methods ?? 'password')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)

    const filteredMethods = methods.filter(m => {
      if (m === 'google'   && row.google_id)   return false
      if (m === 'facebook' && row.facebook_id) return false
      if (m === 'instagram'&& row.instagram_id)return false
      return true
    })

    const newAuthMethods = filteredMethods.length > 0
        ? filteredMethods.join(',')
        : 'password'

    await env.DB.prepare(
        `UPDATE clientes
       SET email = ?, 
           email_pendente = NULL,
           email_verificado = 1,
           token_verificacao = NULL,
           token_verificacao_expira = NULL,
           google_id = NULL,
           facebook_id = NULL,
           instagram_id = NULL,
           auth_methods = ?,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(row.email_pendente, newAuthMethods, row.id).run()

    return Response.redirect(`${BASE_URL}/perfil?email_change=success`, 302)
  } catch (e) {
    console.error('[confirm-email-change] Erro:', e)
    return Response.redirect(`${BASE_URL}/perfil?email_change=error`, 302)
  }
}