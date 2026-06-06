/**
 * /api/discounts/general — descontos gerais ativos (público, sem auth)
 *
 * GET /api/discounts/general
 */

import { ok, serverError, corsOptions } from '../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id IS NULL
        AND ativo = 1
        AND (valido_de  IS NULL OR datetime(valido_de)  <= datetime('now'))
        AND (valido_ate IS NULL OR datetime(valido_ate) >= datetime('now'))
        AND (max_usos   IS NULL OR usos_feitos < max_usos)
      ORDER BY criado_em DESC
    `).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos gerais', e.message)
  }
}
