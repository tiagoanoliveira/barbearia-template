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
    const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '50'), 100)
    const offset = parseInt(url.searchParams.get('offset') ?? '0')

    // Usar idx_clientes_search que já existe no schema original
    const { results } = await env.DB.prepare(`
      SELECT
        c.id,
        c.nome          AS name,
        c.email,
        c.telefone      AS phone,
        c.nif,
        c.foto_perfil   AS photo_url,
        c.reservas_concluidas,
        c.next_appointment_date,
        c.last_appointment_date,
        c.notas,
        c.criado_em     AS created_at
      FROM clientes c
      ${search ? 'WHERE c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?' : ''}
      ORDER BY c.nome COLLATE NOCASE
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
