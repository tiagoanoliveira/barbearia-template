import { ok, badRequest, notFound, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const url   = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) return badRequest('Token em falta')

  try {
    const client = await env.DB.prepare(
      `SELECT id, email_verificado, token_verificacao_expira
       FROM clientes
       WHERE token_verificacao = ?`
    ).bind(token).first()

    if (!client) return notFound('Token inválido ou já utilizado')

    if (client.email_verificado) {
      return Response.redirect(new URL('/login?verified=1', request.url).toString(), 302)
    }

    const expRaw = client.token_verificacao_expira
    if (expRaw && Date.parse(expRaw) < Date.now()) {
      return badRequest('Token expirado. Solicita um novo email de verificação.')
    }

    await env.DB.prepare(
      `UPDATE clientes
          SET email_verificado         = 1,
              token_verificacao        = NULL,
              token_verificacao_expira = NULL,
              atualizado_em            = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).bind(client.id).run()

    return Response.redirect(new URL('/login?verified=1', request.url).toString(), 302)

  } catch (e) {
    return serverError('Erro ao verificar email', e.message)
  }
}
