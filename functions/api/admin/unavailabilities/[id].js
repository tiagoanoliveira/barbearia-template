import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM horarios_indisponiveis WHERE id = ?').bind(id).run()
    return ok({ message: 'Indisponibilidade removida' })
  }

  return badRequest('Método não suportado')
}
