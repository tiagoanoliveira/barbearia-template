/**
 * /api/admin/discounts/client/:id — todos os descontos de um cliente (incl. inativos)
 *
 * GET /api/admin/discounts/client/:id
 */

import { authenticateAdmin } from '../../../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestGet({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const clientId = parseInt(params.id, 10)
  if (!clientId) return ok([])

  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id = ?
      ORDER BY ativo DESC, criado_em DESC
    `).bind(clientId).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos do cliente', e.message)
  }
}
