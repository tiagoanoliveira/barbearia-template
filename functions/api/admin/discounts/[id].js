/**
 * /api/admin/discounts/:id — editar e eliminar (apenas admins)
 *
 * PUT    /api/admin/discounts/:id  → atualizar desconto
 * DELETE /api/admin/discounts/:id  → eliminar desconto
 */

import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestPut({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id, 10)
  if (!id) return badRequest('ID inválido')

  try {
    const body  = await request.json()
    // validação parcial — todos os campos são opcionais no PUT
    if (body.valor_percentagem != null) {
      if (typeof body.valor_percentagem !== 'number' || body.valor_percentagem < 0 || body.valor_percentagem > 100)
        return badRequest('valor_percentagem deve ser entre 0 e 100')
    }
    if (body.valor_fixo_centimos != null) {
      if (typeof body.valor_fixo_centimos !== 'number' || body.valor_fixo_centimos < 0)
        return badRequest('valor_fixo_centimos deve ser positivo')
    }

    const now = new Date().toISOString()
    const { results } = await env.DB.prepare(`
      UPDATE descontos SET
        nome                 = COALESCE(?, nome),
        descricao            = ?,
        tipo                 = COALESCE(?, tipo),
        origem               = ?,
        valor_percentagem    = ?,
        valor_fixo_centimos  = ?,
        valido_de            = ?,
        valido_ate           = ?,
        min_reservas_mes     = ?,
        max_usos             = ?,
        ativo                = COALESCE(?, ativo),
        atualizado_em        = ?
      WHERE id = ?
      RETURNING *
    `).bind(
      body.nome                ?? null,
      body.descricao           !== undefined ? (body.descricao || null) : undefined,
      body.tipo                ?? null,
      body.origem              !== undefined ? (body.origem    || null) : undefined,
      body.valor_percentagem   !== undefined ? (body.valor_percentagem   ?? null) : undefined,
      body.valor_fixo_centimos !== undefined ? (body.valor_fixo_centimos ?? null) : undefined,
      body.valido_de           !== undefined ? (body.valido_de  || null) : undefined,
      body.valido_ate          !== undefined ? (body.valido_ate || null) : undefined,
      body.min_reservas_mes    !== undefined ? (body.min_reservas_mes ?? null) : undefined,
      body.max_usos            !== undefined ? (body.max_usos ?? null) : undefined,
      body.ativo               !== undefined ? (body.ativo ? 1 : 0) : null,
      now,
      id,
    ).all()

    if (!results.length) return notFound('Desconto não encontrado')
    return ok(results[0])
  } catch (e) {
    return serverError('Erro ao atualizar desconto', e.message)
  }
}

export async function onRequestDelete({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id, 10)
  if (!id) return badRequest('ID inválido')

  try {
    await env.DB.prepare('DELETE FROM descontos WHERE id = ?').bind(id).run()
    return ok({ deleted: true })
  } catch (e) {
    return serverError('Erro ao eliminar desconto', e.message)
  }
}
