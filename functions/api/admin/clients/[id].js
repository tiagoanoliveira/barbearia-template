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
        `SELECT id, nome AS name, email, telefone AS phone, nif,
                foto_perfil AS photo_url, reservas_concluidas,
                next_appointment_date, last_appointment_date, notas, criado_em AS created_at
         FROM clientes WHERE id = ?`
      ).bind(id).first(),

      // Usar v_reservas_complete
      env.DB.prepare(`
        SELECT id, data_hora, status, comentario, nota_privada,
               servico_nome, servico_preco, barbeiro_nome, barbeiro_color, duracao_efetiva
        FROM v_reservas_complete
        WHERE cliente_id = ?
        ORDER BY data_hora DESC
        LIMIT 30
      `).bind(id).all(),
    ])

    if (!client) return notFound('Cliente não encontrado')

    return ok({ ...client, reservations })
  } catch (e) {
    return serverError('Erro ao carregar cliente', e.message)
  }
}
