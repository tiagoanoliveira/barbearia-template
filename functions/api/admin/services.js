import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) {
    console.warn('admin/services: pedido não autorizado', {
      url: request.url,
      hasAuthHeader: !!request.headers.get('Authorization'),
    })
    return unauthorized()
  }

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      // sem 'ordem'/'ativo' no schema original
      'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color FROM servicos ORDER BY id'
    ).all()
    return ok(results)
  }

  if (request.method === 'POST') {
    const { name, duration, price, svg, abreviacao, color } = await request.json()
    if (!name || !duration || price == null) return badRequest('Nome, duração e preço são obrigatórios')
    const r = await env.DB.prepare(
      'INSERT INTO servicos (nome, duracao, preco, svg, abreviacao, color) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(
      sanitize(name, 100), parseInt(duration), parseInt(price),
      svg ?? 'null', sanitize(abreviacao ?? 'null', 10), color ?? '#0f7e44'
    ).run()
    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
