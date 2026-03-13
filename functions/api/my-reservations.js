import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  try {
    // Usar v_reservas_complete (view do schema original)
    const { results } = await env.DB.prepare(`
      SELECT
        id,
        cliente_id           AS client_id,
        barbeiro_id          AS barber_id,
        servico_id           AS service_id,
        data_hora,
        status,
        comentario,
        duracao_efetiva       AS duration,
        servico_nome          AS service_name,
        servico_preco         AS price,
        servico_abreviacao    AS service_abbr,
        barbeiro_nome         AS barber_name,
        barbeiro_foto         AS barber_photo,
        barbeiro_color        AS barber_color
      FROM v_reservas_complete
      WHERE cliente_id = ?
      ORDER BY data_hora DESC
      LIMIT 50
    `).bind(auth.clientId).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar reservas', e.message)
  }
}
