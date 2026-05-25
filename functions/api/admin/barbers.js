import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) {
    console.warn('admin/barbers: pedido não autorizado', {
      url: request.url,
      hasAuthHeader: !!request.headers.get('Authorization'),
    })
    return unauthorized()
  }

  if (request.method === 'GET') {
    const url = new URL(request.url)
    const includeInactive = url.searchParams.get('include_inactive') === '1'
    const { results } = await env.DB.prepare(
      // foto, especialidades, color — schema original
      `SELECT id, nome AS name, foto, especialidades, color, ativo AS active
       FROM barbeiros
       ${includeInactive ? '' : 'WHERE ativo = 1'}
       ORDER BY id`
    ).all()
    return ok(results)
  }

  if (request.method === 'POST') {
    const { name, especialidades, foto, color } = await request.json()
    if (!name) return badRequest('Nome é obrigatório')
    const r = await env.DB.prepare(
      'INSERT INTO barbeiros (nome, especialidades, foto, color, ativo) VALUES (?, ?, ?, ?, 1)'
    ).bind(
      sanitize(name, 100),
      sanitize(especialidades ?? '', 200),
      foto ?? null,
      color ?? '#ffffff'
    ).run()
    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
