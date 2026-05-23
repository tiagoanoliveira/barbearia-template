import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, notFound, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

/**
 * GET    /api/admin/brands        → lista todas as marcas
 * POST   /api/admin/brands        → cria nova marca
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, logo_url, website_url, ordem FROM marcas ORDER BY ordem ASC, id ASC'
    ).all()
    return ok(results)
  }

  if (request.method === 'POST') {
    const body = await request.json()
    const name = sanitize(body.name ?? '', 100)
    if (!name) return badRequest('Nome é obrigatório')
    const logo_url    = body.logo_url    ? sanitize(body.logo_url,    500) : null
    const website_url = body.website_url ? sanitize(body.website_url, 500) : null
    const ordem       = body.ordem != null ? parseInt(body.ordem) : 0

    const r = await env.DB.prepare(
      'INSERT INTO marcas (nome, logo_url, website_url, ordem) VALUES (?, ?, ?, ?)'
    ).bind(name, logo_url, website_url, ordem).run()
    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
