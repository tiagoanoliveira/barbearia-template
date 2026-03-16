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

  const BASE_URL = 'https://brooklynbarbearia.pt'

  if (!token) {
    return Response.redirect(`${BASE_URL}/perfil?email_change=invalid`, 302)
  }

  try {
    const row = await env.DB.prepare(
      `SELECT cliente_id, new_email, expires_at
       FROM email_change_tokens
       WHERE token = ? LIMIT 1`
    ).bind(token).first()

    if (!row) {
      return Response.redirect(`${BASE_URL}/perfil?email_change=invalid`, 302)
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare('DELETE FROM email_change_tokens WHERE token = ?').bind(token).run()
      return Response.redirect(`${BASE_URL}/perfil?email_change=expired`, 302)
    }

    // Verificar se o novo email já está em uso por outro cliente
    const existing = await env.DB.prepare(
      'SELECT id FROM clientes WHERE email = ? AND id != ?'
    ).bind(row.new_email, row.cliente_id).first()

    if (existing) {
      await env.DB.prepare('DELETE FROM email_change_tokens WHERE token = ?').bind(token).run()
      return Response.redirect(`${BASE_URL}/perfil?email_change=taken`, 302)
    }

    // Aplicar a alteração de email
    await env.DB.prepare(
      `UPDATE clientes
       SET email = ?, email_verificado = 1, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(row.new_email, row.cliente_id).run()

    // Limpar o token usado
    await env.DB.prepare(
      'DELETE FROM email_change_tokens WHERE token = ?'
    ).bind(token).run()

    return Response.redirect(`${BASE_URL}/perfil?email_change=success`, 302)
  } catch (e) {
    console.error('[confirm-email-change] Erro:', e)
    return Response.redirect(`${BASE_URL}/perfil?email_change=error`, 302)
  }
}
