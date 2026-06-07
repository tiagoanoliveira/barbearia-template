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
    const body = await request.json()

    if (body.valor_percentagem != null) {
      if (typeof body.valor_percentagem !== 'number' || body.valor_percentagem < 0 || body.valor_percentagem > 100)
        return badRequest('valor_percentagem deve ser entre 0 e 100')
    }
    if (body.valor_fixo_centimos != null) {
      if (typeof body.valor_fixo_centimos !== 'number' || body.valor_fixo_centimos < 0)
        return badRequest('valor_fixo_centimos deve ser positivo')
    }
    if (body.min_reservas != null && (typeof body.min_reservas !== 'number' || body.min_reservas < 0))
      return badRequest('min_reservas deve ser um número >= 0')

    // Serialize servicos_ids array to JSON string if present
    const servicosJson = body.servicos_ids !== undefined
      ? (Array.isArray(body.servicos_ids) && body.servicos_ids.length > 0
          ? JSON.stringify(body.servicos_ids)
          : null)
      : undefined

    const now = new Date().toISOString()

    // Build SET clauses dynamically to avoid passing undefined to D1
    const sets = []
    const args = []

    if (body.nome !== undefined)                { sets.push('nome = COALESCE(?, nome)');                 args.push(body.nome ?? null) }
    if (body.descricao !== undefined)            { sets.push('descricao = ?');                            args.push(body.descricao || null) }
    if (body.tipo !== undefined)                 { sets.push('tipo = COALESCE(?, tipo)');                 args.push(body.tipo ?? null) }
    if (body.origem !== undefined)               { sets.push('origem = ?');                               args.push(body.origem || null) }
    if (body.valor_percentagem !== undefined)    { sets.push('valor_percentagem = ?');                    args.push(body.valor_percentagem ?? null) }
    if (body.valor_fixo_centimos !== undefined)  { sets.push('valor_fixo_centimos = ?');                  args.push(body.valor_fixo_centimos ?? null) }
    if (body.valido_de !== undefined)            { sets.push('valido_de = ?');                            args.push(body.valido_de || null) }
    if (body.valido_ate !== undefined)           { sets.push('valido_ate = ?');                           args.push(body.valido_ate || null) }
    if (body.min_reservas !== undefined)         { sets.push('min_reservas = ?');                         args.push(body.min_reservas ?? null) }
    if (body.min_reservas_periodo !== undefined) { sets.push('min_reservas_periodo = ?');                 args.push(body.min_reservas_periodo || null) }
    if (body.grupo !== undefined)                { sets.push('grupo = ?');                                args.push(body.grupo || null) }
    if (body.regra_tipo !== undefined)           { sets.push('regra_tipo = ?');                           args.push(body.regra_tipo || null) }
    if (body.regra_detalhe !== undefined)        { sets.push('regra_detalhe = ?');                        args.push(body.regra_detalhe || null) }
    if (servicosJson !== undefined)              { sets.push('servicos_ids = ?');                         args.push(servicosJson) }
    if (body.max_usos !== undefined)             { sets.push('max_usos = ?');                             args.push(body.max_usos ?? null) }
    if (body.ativo !== undefined)                { sets.push('ativo = ?');                                args.push(body.ativo ? 1 : 0) }

    if (sets.length === 0) return badRequest('Nenhum campo para atualizar')

    sets.push('atualizado_em = ?')
    args.push(now)
    args.push(id)

    const { results } = await env.DB.prepare(
      `UPDATE descontos SET ${sets.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...args).all()

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
