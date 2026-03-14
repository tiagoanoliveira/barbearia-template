import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

const VALID_STATUSES = ['confirmada', 'cancelada', 'concluida', 'faltou']

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  const reservation = await env.DB.prepare(
    `SELECT id, status, data_hora, comentario, nota_privada,
            cliente_nome, barbeiro_nome, servico_nome
     FROM v_reservas_complete WHERE id = ?`
  ).bind(id).first()

  if (!reservation) return notFound('Reserva não encontrada')

  if (request.method === 'GET') return ok(reservation)

  if (request.method === 'PATCH') {
    try {
      const body = await request.json()
      const { status, notes, private_note } = body

      if (status && !VALID_STATUSES.includes(status)) return badRequest('Status inválido')

      const updates = []
      const vals    = []

      if (status        !== undefined) { updates.push('status = ?');       vals.push(status) }
      if (notes         !== undefined) { updates.push('comentario = ?');   vals.push(sanitize(notes, 2000)) }
      if (private_note  !== undefined) { updates.push('nota_privada = ?'); vals.push(sanitize(private_note, 2000)) }

      if (!updates.length) return badRequest('Nada para actualizar')

      updates.push('atualizado_em = CURRENT_TIMESTAMP')

      await env.DB.prepare(
        `UPDATE reservas SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...vals, id).run()

      return ok({ message: 'Reserva actualizada' })
    } catch (e) {
      return serverError('Erro ao actualizar reserva', e.message)
    }
  }

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
