/**
 * /api/admin/produto-categorias/:id
 *
 * PUT    → editar categoria
 * DELETE → eliminar categoria (só se não tiver produtos associados)
 */

import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── PUT — editar ──────────────────────────────────────────────────────────────
export async function onRequestPut({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    const body = await request.json()
    const now  = new Date().toISOString()

    const fields = []
    const args   = []

    if (body.nome      !== undefined) { fields.push('nome = ?');      args.push(body.nome.trim()) }
    if (body.descricao !== undefined) { fields.push('descricao = ?'); args.push(body.descricao) }
    if (body.ordem     !== undefined) { fields.push('ordem = ?');     args.push(body.ordem) }
    if (body.ativo     !== undefined) { fields.push('ativo = ?');     args.push(body.ativo ? 1 : 0) }

    if (!fields.length) return badRequest('Nenhum campo para atualizar')

    fields.push('atualizado_em = ?')
    args.push(now)
    args.push(id)

    const { results } = await env.DB.prepare(
      `UPDATE produto_categorias SET ${fields.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...args).all()

    if (!results.length) return notFound('Categoria não encontrada')
    return ok(results[0])
  } catch (e) {
    return serverError('Erro ao atualizar categoria', e.message)
  }
}

// ─── DELETE — eliminar ─────────────────────────────────────────────────────────
export async function onRequestDelete({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    // Verificar se existe produtos associados
    const { results: prods } = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM produtos WHERE categoria_id = ?'
    ).bind(id).all()

    if (prods[0]?.total > 0) {
      return badRequest('Não é possível eliminar uma categoria com produtos associados. Desative-a ou mova os produtos primeiro.')
    }

    const { meta } = await env.DB.prepare(
      'DELETE FROM produto_categorias WHERE id = ?'
    ).bind(id).run()

    if (meta.changes === 0) return notFound('Categoria não encontrada')
    return ok({ deleted: true })
  } catch (e) {
    return serverError('Erro ao eliminar categoria', e.message)
  }
}
