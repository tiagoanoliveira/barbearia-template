import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, badRequest, unauthorized, notFound, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

/**
 * PUT    /api/admin/brands/:id    → edita marca
 * DELETE /api/admin/brands/:id    → apaga marca
 */
export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (!id) return badRequest('ID inválido')

  const existing = await env.DB.prepare('SELECT id FROM marcas WHERE id = ?').bind(id).first()
  if (!existing) return notFound('Marca não encontrada')

  if (request.method === 'PUT') {
    const body = await request.json()
    const name = sanitize(body.name ?? '', 100)
    if (!name) return badRequest('Nome é obrigatório')
    const logo_url    = body.logo_url    ? sanitize(body.logo_url,    500) : null
    const website_url = body.website_url ? sanitize(body.website_url, 500) : null
    const ordem       = body.ordem != null ? parseInt(body.ordem) : 0

    await env.DB.prepare(
      'UPDATE marcas SET nome = ?, logo_url = ?, website_url = ?, ordem = ? WHERE id = ?'
    ).bind(name, logo_url, website_url, ordem, id).run()
    return ok({ updated: true })
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM marcas WHERE id = ?').bind(id).run()
    return ok({ deleted: true })
  }

  return badRequest('Método não suportado')
}
