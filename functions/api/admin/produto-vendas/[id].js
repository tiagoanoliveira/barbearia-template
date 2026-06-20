/**
 * /api/admin/produto-vendas/:id
 *
 * GET → detalhe completo de uma venda (admin vê só as suas; superAdmin vê todas)
 */

import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

export async function onRequestGet({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    const { results: vendas } = await env.DB.prepare(`
      SELECT
        pv.id, pv.total_centimos, pv.meio_pagamento, pv.notas, pv.criado_em,
        pv.admin_user_id, au.nome AS admin_user_nome,
        pv.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
      FROM produto_vendas pv
      JOIN admin_users au ON pv.admin_user_id = au.id
      LEFT JOIN clientes c ON pv.cliente_id = c.id
      WHERE pv.id = ?
    `).bind(id).all()

    if (!vendas.length) return notFound('Venda não encontrada')

    const venda = vendas[0]

    // Admins normais só podem ver as suas vendas
    if (adminAuth.role !== 'superAdmin' && venda.admin_user_id !== adminAuth.adminId) {
      return unauthorized()
    }

    const { results: itens } = await env.DB.prepare(`
      SELECT
        pvi.produto_id, pvi.quantidade, pvi.preco_unitario_centimos,
        p.nome AS produto_nome, p.descricao AS produto_descricao,
        pc.nome AS categoria_nome
      FROM produto_venda_itens pvi
      JOIN produtos p ON pvi.produto_id = p.id
      JOIN produto_categorias pc ON p.categoria_id = pc.id
      WHERE pvi.venda_id = ?
    `).bind(id).all()

    venda.itens = itens
    return ok(venda)
  } catch (e) {
    return serverError('Erro ao obter venda', e.message)
  }
}
