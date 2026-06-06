/**
 * /api/discounts — Endpoints públicos de descontos (apenas leitura)
 *
 * Rotas:
 *   GET /api/discounts/general      → descontos gerais ativos (público, sem auth)
 *   GET /api/discounts/client/:id   → descontos de um cliente (auth: admin ou próprio cliente)
 */

import { authenticateAdmin, authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestGet({ request, env }) {
  const url     = new URL(request.url)
  const pathRaw = url.pathname.replace(/^\/api\/discounts/, '')
  const path    = pathRaw.replace(/^\//, '')

  // GET /api/discounts/general — público, sem auth
  if (path === 'general') {
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

  // GET /api/discounts/client/:id — admin ou próprio cliente
  const clientMatch = path.match(/^client\/(\d+)$/)
  if (clientMatch) {
    const clientId = parseInt(clientMatch[1])

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

  return unauthorized()
}
