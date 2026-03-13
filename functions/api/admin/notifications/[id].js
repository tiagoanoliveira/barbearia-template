import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  // PATCH — marcar como lida
  if (request.method === 'PATCH') {
    await env.DB.prepare(
      'UPDATE notifications SET is_read = 1 WHERE id = ?'
    ).bind(id).run()
    return ok({ message: 'Notificação marcada como lida' })
  }

  return badRequest('Método não suportado')
}
