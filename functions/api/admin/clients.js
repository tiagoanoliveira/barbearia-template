import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  try {
    const url    = new URL(request.url)
    const search = url.searchParams.get('search') ?? ''
    const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    const { results } = await env.DB.prepare(`
      SELECT
        c.id, c.nome AS name, c.email, c.telefone AS phone, c.nif,
        c.created_at,
        COUNT(r.id)            AS total_reservations,
        SUM(CASE WHEN r.status = 'concluida' THEN s.preco ELSE 0 END) AS total_spent,
        MAX(r.data_hora)       AS last_visit
      FROM clientes c
      LEFT JOIN reservas  r ON r.cliente_id = c.id
      LEFT JOIN servicos  s ON s.id = r.servico_id
      ${search ? 'WHERE c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?' : ''}
      GROUP BY c.id
      ORDER BY c.nome
      LIMIT ? OFFSET ?
    `).bind(
      ...(search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []),
      limit, offset
    ).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar clientes', e.message)
  }
}
