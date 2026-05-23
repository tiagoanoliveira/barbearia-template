import { ok, serverError, corsOptions } from '../utils/response.js'

/**
 * GET /api/brands  →  lista pública de marcas (sem autenticação)
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, logo_url, website_url FROM marcas ORDER BY ordem ASC, id ASC'
    ).all()
    return ok(results)
  } catch (e) {
    console.error('GET /api/brands error:', e)
    return serverError('Erro ao carregar marcas')
  }
}
