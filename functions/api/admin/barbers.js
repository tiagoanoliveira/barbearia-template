import { authenticateAdmin } from '../../utils/auth.js'
import {
  ok, created, badRequest, unauthorized,
  notFound, serverError, corsOptions
} from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // GET
  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, foto_url AS photo_url, ativo AS active FROM barbeiros ORDER BY nome'
    ).all()
    return ok(results)
  }

  // POST
  if (request.method === 'POST') {
    const { name, photo_url } = await request.json()
    if (!name) return badRequest('Nome é obrigatório')
    const r = await env.DB.prepare(
      'INSERT INTO barbeiros (nome, foto_url, ativo) VALUES (?, ?, 1)'
    ).bind(sanitize(name, 100), photo_url ?? null).run()
    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
