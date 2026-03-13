import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize, isValidId } from '../../../utils/validators.js'

const VALID_STATUSES = ['confirmada', 'cancelada', 'concluida', 'faltou', 'pendente']

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  const reservation = await env.DB.prepare(
    `SELECT r.id, r.status, r.data_hora, r.comentario,
            c.nome AS client_name, b.nome AS barber_name, s.nome AS service_name
     FROM reservas r
     JOIN clientes c ON c.id = r.cliente_id
     JOIN barbeiros b ON b.id = r.barbeiro_id
     JOIN servicos s ON s.id = r.servico_id
     WHERE r.id = ?`
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')

  // GET
  if (request.method === 'GET') return ok(reservation)

  // PATCH — actualizar status / notas
  if (request.method === 'PATCH') {
    try {
      const body = await request.json()
      const { status, notes } = body

      if (status && !VALID_STATUSES.includes(status)) return badRequest('Status inválido')

      const updates = []
      const vals    = []

      if (status) { updates.push('status = ?');       vals.push(status) }
      if (notes !== undefined) { updates.push('comentario = ?'); vals.push(sanitize(notes, 2000)) }

      if (!updates.length) return badRequest('Nada para actualizar')

      await env.DB.prepare(
        `UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...vals, id).run()

      return ok({ message: 'Reserva actualizada' })
    } catch (e) {
      return serverError('Erro ao actualizar reserva', e.message)
    }
  }

  // DELETE
  if (request.method === 'DELETE') {
    try {
      await env.DB.prepare('DELETE FROM reservas WHERE id = ?').bind(id).run()
      return ok({ message: 'Reserva eliminada' })
    } catch (e) {
      return serverError('Erro ao eliminar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}
