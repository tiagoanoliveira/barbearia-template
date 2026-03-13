import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)

  if (request.method === 'PUT') {
    const { name, photo_url, active } = await request.json()
    await env.DB.prepare(
      'UPDATE barbeiros SET nome = ?, foto_url = ?, ativo = ? WHERE id = ?'
    ).bind(sanitize(name, 100), photo_url ?? null, active ? 1 : 0, id).run()
    return ok({ message: 'Barbeiro atualizado' })
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('UPDATE barbeiros SET ativo = 0 WHERE id = ?').bind(id).run()
    return ok({ message: 'Barbeiro desativado' })
  }

  return badRequest('Método não suportado')
}
