import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  try {
    const { results } = await env.DB.prepare(`
      SELECT
        r.id,
        s.nome  AS service_name,
        b.nome  AS barber_name,
        date(r.data_hora) AS date,
        time(r.data_hora) AS time,
        r.status,
        r.comentario AS notes,
        r.duracao_minutos AS duration,
        s.preco AS price
      FROM reservas r
      JOIN servicos   s ON s.id = r.servico_id
      JOIN barbeiros  b ON b.id = r.barbeiro_id
      WHERE r.cliente_id = ?
      ORDER BY r.data_hora DESC
      LIMIT 50
    `).bind(auth.clientId).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar reservas', e.message)
  }
}
