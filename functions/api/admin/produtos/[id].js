/**
 * /api/admin/produtos/:id
 *
 * PUT    → editar produto
 * DELETE → eliminar produto (só se não houver vendas associadas)
 */

import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'
import { validateProdutoBody } from '../produtos.js'

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
    const body  = await request.json()
    const erros = validateProdutoBody(body, true)
    if (erros.length) return badRequest(erros.join('; '))

    const now    = new Date().toISOString()
    const fields = []
    const args   = []

    if (body.categoria_id   !== undefined) { fields.push('categoria_id = ?');   args.push(body.categoria_id) }
    if (body.nome           !== undefined) { fields.push('nome = ?');           args.push(body.nome.trim()) }
    if (body.descricao      !== undefined) { fields.push('descricao = ?');      args.push(body.descricao) }
    if (body.preco_centimos !== undefined) { fields.push('preco_centimos = ?'); args.push(body.preco_centimos) }
    if (body.ordem          !== undefined) { fields.push('ordem = ?');          args.push(body.ordem) }
    if (body.ativo          !== undefined) { fields.push('ativo = ?');          args.push(body.ativo ? 1 : 0) }

    if (!fields.length) return badRequest('Nenhum campo para atualizar')

    fields.push('atualizado_em = ?')
    args.push(now)
    args.push(id)

    const { results } = await env.DB.prepare(
      `UPDATE produtos SET ${fields.join(', ')} WHERE id = ? RETURNING *`
    ).bind(...args).all()

    if (!results.length) return notFound('Produto não encontrado')
    return ok(results[0])
  } catch (e) {
    return serverError('Erro ao atualizar produto', e.message)
  }
}

// ─── DELETE — eliminar ─────────────────────────────────────────────────────────
export async function onRequestDelete({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    // Verificar se existem itens de venda associados
    const { results: itens } = await env.DB.prepare(
      'SELECT COUNT(*) AS total FROM produto_venda_itens WHERE produto_id = ?'
    ).bind(id).all()

    if (itens[0]?.total > 0) {
      return badRequest('Não é possível eliminar um produto com vendas associadas. Desative-o em vez de eliminar.')
    }

    const { meta } = await env.DB.prepare(
      'DELETE FROM produtos WHERE id = ?'
    ).bind(id).run()

    if (meta.changes === 0) return notFound('Produto não encontrado')
    return ok({ deleted: true })
  } catch (e) {
    return serverError('Erro ao eliminar produto', e.message)
  }
}
