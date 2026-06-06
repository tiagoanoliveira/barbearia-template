/**
 * /api/admin/discounts/:id/apply — aplicar desconto numa reserva (checkout)
 *
 * POST /api/admin/discounts/:id/apply
 */

import { authenticateAdmin } from '../../../../utils/auth.js'
import { ok, unauthorized, badRequest, notFound, serverError, corsOptions } from '../../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestPost({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const descontoId = parseInt(params.id, 10)
  if (!descontoId) return badRequest('ID inválido')

  try {
    const { reserva_id, oferta_valor } = await request.json()
    if (!reserva_id) return badRequest('reserva_id obrigatório')

    const desconto = await env.DB.prepare(
      'SELECT * FROM descontos WHERE id = ?'
    ).bind(descontoId).first()

    if (!desconto)       return notFound('Desconto não encontrado')
    if (!desconto.ativo) return badRequest('Desconto inativo')
    if (desconto.max_usos !== null && desconto.usos_feitos >= desconto.max_usos) {
      return badRequest('Desconto já esgotado')
    }

    const reserva = await env.DB.prepare(
      'SELECT data_hora, cliente_id FROM reservas WHERE id = ?'
    ).bind(reserva_id).first()
    if (!reserva) return notFound('Reserva não encontrada')

    const now        = new Date().toISOString()
    const novoUsos   = desconto.usos_feitos + 1
    const esgotado   = desconto.max_usos !== null && novoUsos >= desconto.max_usos
    const comentario = `Usado na reserva #${reserva_id} em ${reserva.data_hora}`

    await env.DB.prepare(`
      UPDATE reservas
      SET desconto_id   = ?,
          oferta_valor  = COALESCE(?, oferta_valor),
          oferta_tipo   = ?,
          atualizado_em = ?
      WHERE id = ?
    `).bind(descontoId, oferta_valor ?? null, desconto.tipo, now, reserva_id).run()

    await env.DB.prepare(`
      UPDATE descontos
      SET usos_feitos             = ?,
          usado_ultima_vez_em     = ?,
          usado_ultima_reserva_id = ?,
          comentario_uso          = ?,
          ativo                   = ?,
          atualizado_em           = ?
      WHERE id = ?
    `).bind(novoUsos, now, reserva_id, comentario, esgotado ? 0 : 1, now, descontoId).run()

    return ok({ desconto_id: descontoId, esgotado })
  } catch (e) {
    return serverError('Erro ao aplicar desconto', e.message)
  }
}
