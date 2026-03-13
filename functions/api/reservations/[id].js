import { authenticateClient } from '../../utils/auth.js'
import {
  ok, unauthorized, notFound, forbidden,
  badRequest, serverError, corsOptions
} from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  // Buscar reserva
  const reservation = await env.DB.prepare(
    'SELECT id, cliente_id, status FROM reservas WHERE id = ?'
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')

  // Só o próprio cliente pode operar
  if (reservation.cliente_id !== auth.clientId) return forbidden()

  // DELETE — cancelar
  if (request.method === 'DELETE') {
    try {
      if (!['confirmada', 'pendente'].includes(reservation.status)) {
        return badRequest('Apenas reservas pendentes ou confirmadas podem ser canceladas')
      }

      await env.DB.prepare(
        "UPDATE reservas SET status = 'cancelada' WHERE id = ?"
      ).bind(id).run()

      return ok({ message: 'Reserva cancelada' })
    } catch (e) {
      return serverError('Erro ao cancelar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}
