/**
 * /api/discounts/client/:id — descontos ativos de um cliente
 * Auth: admin ou o próprio cliente
 *
 * GET /api/discounts/client/:id
 */

import { authenticateAdmin, authenticateClient } from '../../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestGet({ request, env, params }) {
  const clientId = parseInt(params.id, 10)
  if (!clientId) return ok([])

  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) {
    const clientAuth = await authenticateClient(request, env)
    if (!clientAuth.success || clientAuth.clientId !== clientId) {
      return unauthorized()
    }
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id = ?
        AND ativo = 1
        AND (valido_de  IS NULL OR datetime(valido_de)  <= datetime('now'))
        AND (valido_ate IS NULL OR datetime(valido_ate) >= datetime('now'))
        AND (max_usos   IS NULL OR usos_feitos < max_usos)
      ORDER BY criado_em DESC
    `).bind(clientId).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos do cliente', e.message)
  }
}
