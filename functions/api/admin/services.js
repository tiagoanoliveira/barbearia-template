import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, duracao AS duration, preco AS price, ativo AS active, ordem AS order FROM servicos ORDER BY ordem, id'
    ).all()
    return ok(results)
  }

  if (request.method === 'POST') {
    const { name, duration, price } = await request.json()
    if (!name || !duration || price == null) return badRequest('Nome, duração e preço são obrigatórios')
    const r = await env.DB.prepare(
      'INSERT INTO servicos (nome, duracao, preco, ativo) VALUES (?, ?, ?, 1)'
    ).bind(sanitize(name, 100), parseInt(duration), parseInt(price)).run()
    return created({ id: r.meta.last_row_id })
  }

  return badRequest('Método não suportado')
}
