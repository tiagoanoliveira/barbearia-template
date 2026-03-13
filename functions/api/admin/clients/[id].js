import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)

  try {
    const [client, { results: reservations }] = await Promise.all([
      env.DB.prepare(
        'SELECT id, nome AS name, email, telefone AS phone, nif, created_at FROM clientes WHERE id = ?'
      ).bind(id).first(),
      env.DB.prepare(`
        SELECT r.id, r.data_hora, r.status, r.comentario,
               s.nome AS service_name, s.preco AS price,
               b.nome AS barber_name
        FROM reservas r
        JOIN servicos  s ON s.id = r.servico_id
        JOIN barbeiros b ON b.id = r.barbeiro_id
        WHERE r.cliente_id = ?
        ORDER BY r.data_hora DESC
        LIMIT 30
      `).bind(id).all(),
    ])

    if (!client) return notFound('Cliente não encontrado')

    return ok({ ...client, reservations })
  } catch (e) {
    return serverError('Erro ao carregar cliente', e.message)
  }
}
