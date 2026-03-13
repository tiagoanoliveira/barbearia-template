import { authenticateClient } from '../../../utils/auth.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../../utils/response.js'

/**
 * DELETE /api/auth/facebook/unlink
 * Mesma lógica de segurança do Google, preparada para quando o OAuth Facebook estiver activo.
 */
export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'DELETE') return badRequest('Método não permitido')

  try {
    const auth = await authenticateClient(request, env)
    if (!auth.success) return unauthorized()

    const client = await env.DB.prepare(
      `SELECT google_id, facebook_id, instagram_id, password_hash, auth_methods
       FROM clientes WHERE id = ?`
    ).bind(auth.clientId).first()

    if (!client) return badRequest('Utilizador não encontrado')

    let methodsCount = 0
    if (client.google_id)    methodsCount++
    if (client.facebook_id)  methodsCount++
    if (client.instagram_id) methodsCount++

    const hasPassword = !!(
      client.password_hash &&
      client.password_hash !== 'cliente_nunca_iniciou_sessão' &&
      client.password_hash !== ''
    )
    if (hasPassword) methodsCount++

    if (methodsCount === 1 && !hasPassword) {
      return badRequest('Não pode desassociar o último método de autenticação sem definir uma password primeiro')
    }

    await env.DB.prepare(
      `UPDATE clientes
       SET facebook_id = NULL,
           auth_methods = REPLACE(REPLACE(REPLACE(
             auth_methods,
             ',facebook', ''
           ), 'facebook,', ''), 'facebook', ''),
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(auth.clientId).run()

    return ok({ message: 'Conta Facebook desassociada com sucesso' })
  } catch (e) {
    return serverError('Erro ao desassociar conta Facebook', e.message)
  }
}
