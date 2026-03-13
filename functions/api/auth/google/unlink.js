import { authenticateClient } from '../../../utils/auth.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../../utils/response.js'

/**
 * DELETE /api/auth/google/unlink
 * Desassocia a conta Google do cliente autenticado.
 * Regra: não deixa remover o último método de autenticação se não existir password definida.
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

    // Contar métodos de autenticação activos
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

    // Actualizar google_id e auth_methods string
    await env.DB.prepare(
      `UPDATE clientes
       SET google_id = NULL,
           auth_methods = REPLACE(REPLACE(REPLACE(
             auth_methods,
             ',google', ''
           ), 'google,', ''), 'google', ''),
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(auth.clientId).run()

    return ok({ message: 'Conta Google desassociada com sucesso' })
  } catch (e) {
    return serverError('Erro ao desassociar conta Google', e.message)
  }
}
