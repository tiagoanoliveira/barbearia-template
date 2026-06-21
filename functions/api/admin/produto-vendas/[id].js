/**
 * /api/admin/produto-vendas/:id
 *
 * GET   → detalhe completo de uma venda
 * PATCH → editar venda (qualquer admin autenticado pode editar; só vê as suas excepto superAdmin)
 */

import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, notFound, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET ────────────────────────────────────────────────────
export async function onRequestGet({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    const { results: vendas } = await env.DB.prepare(`
      SELECT
        pv.id, pv.total_centimos, pv.meio_pagamento, pv.notas, pv.criado_em,
        pv.gorjeta, pv.meio_gorjeta, pv.oferta_tipo, pv.oferta_valor,
        pv.admin_user_id, au.nome AS admin_user_nome,
        pv.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
      FROM produto_vendas pv
      JOIN admin_users au ON pv.admin_user_id = au.id
      LEFT JOIN clientes c ON pv.cliente_id = c.id
      WHERE pv.id = ?
    `).bind(id).all()

    if (!vendas.length) return notFound('Venda não encontrada')
    const venda = vendas[0]

    if (adminAuth.role !== 'superAdmin' && venda.admin_user_id !== adminAuth.adminId)
      return unauthorized()

    const { results: itens } = await env.DB.prepare(`
      SELECT
        pvi.produto_id, pvi.quantidade, pvi.preco_unitario_centimos, pvi.oferta,
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

// ─── PATCH ─────────────────────────────────────────────────
export async function onRequestPatch({ request, env, params }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  try {
    const { results: existing } = await env.DB.prepare(
      'SELECT id, admin_user_id FROM produto_vendas WHERE id = ?'
    ).bind(id).all()
    if (!existing.length) return notFound('Venda não encontrada')

    const venda = existing[0]
    // Admins normais só podem editar as suas próprias vendas
    if (adminAuth.role !== 'superAdmin' && venda.admin_user_id !== adminAuth.adminId)
      return unauthorized()

    const body = await request.json()

    // — Validar itens —
    if (body.itens !== undefined) {
      if (!Array.isArray(body.itens) || body.itens.length === 0)
        return badRequest('itens não pode ser vazio')
      for (const item of body.itens) {
        if (!item.produto_id)                        return badRequest('produto_id obrigatório em cada item')
        if (!item.quantidade || item.quantidade < 1) return badRequest('quantidade deve ser >= 1')
        if (item.preco_unitario_centimos != null) {
          const p = Number(item.preco_unitario_centimos)
          if (!Number.isFinite(p) || p < 0) return badRequest('preco_unitario_centimos inválido')
        }
      }
    }

    // — Gorjeta —
    const gorjeta = body.gorjeta != null ? Number(body.gorjeta) : undefined
    if (gorjeta !== undefined && (!Number.isFinite(gorjeta) || gorjeta < 0))
      return badRequest('gorjeta deve ser número não-negativo')

    // — Calcular total a partir dos itens —
    let totalCentimos = body.total_centimos
    if (body.itens !== undefined) {
      const isOferta = (body.meio_pagamento ?? '') === 'oferta'
      totalCentimos = isOferta ? 0 : body.itens.reduce((acc, i) => {
        const eOferta = i.oferta === true || i.oferta === 1
        return acc + (eOferta ? 0 : (i.preco_unitario_centimos ?? 0) * i.quantidade)
      }, 0)
    }

    // — Validar admin_user_id se fornecido —
    let novoAdminUserId = undefined
    if (body.admin_user_id !== undefined && body.admin_user_id !== null) {
      const uid = parseInt(body.admin_user_id)
      if (isNaN(uid)) return badRequest('admin_user_id inválido')
      // Verificar que o admin existe
      const { results: adminCheck } = await env.DB.prepare(
        'SELECT id FROM admin_users WHERE id = ?'
      ).bind(uid).all()
      if (!adminCheck.length) return badRequest('admin_user_id não encontrado')
      novoAdminUserId = uid
    }

    // — Atualizar venda —
    const setFields = []
    const setArgs   = []

    if (body.meio_pagamento !== undefined) { setFields.push('meio_pagamento = ?'); setArgs.push(body.meio_pagamento) }
    if (totalCentimos       !== undefined) { setFields.push('total_centimos = ?'); setArgs.push(totalCentimos) }
    if (body.notas          !== undefined) { setFields.push('notas = ?');          setArgs.push(body.notas) }
    if (gorjeta             !== undefined) { setFields.push('gorjeta = ?');        setArgs.push(gorjeta) }
    if (body.meio_gorjeta   !== undefined) { setFields.push('meio_gorjeta = ?');   setArgs.push(body.meio_gorjeta) }
    if (body.oferta_tipo    !== undefined) { setFields.push('oferta_tipo = ?');    setArgs.push(body.oferta_tipo) }
    if (body.oferta_valor   !== undefined) { setFields.push('oferta_valor = ?');   setArgs.push(body.oferta_valor) }
    if (body.cliente_id     !== undefined) { setFields.push('cliente_id = ?');     setArgs.push(body.cliente_id) }
    if (novoAdminUserId     !== undefined) { setFields.push('admin_user_id = ?');  setArgs.push(novoAdminUserId) }

    if (setFields.length > 0) {
      await env.DB.prepare(
        `UPDATE produto_vendas SET ${setFields.join(', ')} WHERE id = ?`
      ).bind(...setArgs, id).run()
    }

    // — Substituir itens —
    if (body.itens !== undefined) {
      const prodIds      = [...new Set(body.itens.map(i => i.produto_id))]
      const placeholders = prodIds.map(() => '?').join(',')
      const { results: produtos } = await env.DB.prepare(
        `SELECT id, preco_centimos, ativo FROM produtos WHERE id IN (${placeholders})`
      ).bind(...prodIds).all()
      const prodMap = Object.fromEntries(produtos.map(p => [p.id, p]))

      for (const item of body.itens) {
        const prod = prodMap[item.produto_id]
        if (!prod)       return badRequest(`Produto ${item.produto_id} não encontrado`)
        if (!prod.ativo) return badRequest(`Produto ${item.produto_id} está inativo`)
      }

      await env.DB.prepare('DELETE FROM produto_venda_itens WHERE venda_id = ?').bind(id).run()

      for (const item of body.itens) {
        const prod      = prodMap[item.produto_id]
        const precoUnit = item.preco_unitario_centimos != null ? Number(item.preco_unitario_centimos) : prod.preco_centimos
        const eOferta   = item.oferta === true || item.oferta === 1 ? 1 : 0
        await env.DB.prepare(
          'INSERT INTO produto_venda_itens (venda_id, produto_id, quantidade, preco_unitario_centimos, oferta) VALUES (?, ?, ?, ?, ?)'
        ).bind(id, item.produto_id, item.quantidade, precoUnit, eOferta).run()
      }
    }

    // Devolver a venda atualizada
    const { results: updatedVendas } = await env.DB.prepare(`
      SELECT
        pv.id, pv.total_centimos, pv.meio_pagamento, pv.notas, pv.criado_em,
        pv.gorjeta, pv.meio_gorjeta, pv.oferta_tipo, pv.oferta_valor,
        pv.admin_user_id, au.nome AS admin_user_nome,
        pv.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
      FROM produto_vendas pv
      JOIN admin_users au ON pv.admin_user_id = au.id
      LEFT JOIN clientes c ON pv.cliente_id = c.id
      WHERE pv.id = ?
    `).bind(id).all()

    const updated = updatedVendas[0]
    const { results: updatedItens } = await env.DB.prepare(`
      SELECT pvi.produto_id, pvi.quantidade, pvi.preco_unitario_centimos, pvi.oferta,
             p.nome AS produto_nome, pc.nome AS categoria_nome
      FROM produto_venda_itens pvi
      JOIN produtos p ON pvi.produto_id = p.id
      JOIN produto_categorias pc ON p.categoria_id = pc.id
      WHERE pvi.venda_id = ?
    `).bind(id).all()
    updated.itens = updatedItens

    return ok(updated)
  } catch (e) {
    return serverError('Erro ao atualizar venda', e.message)
  }
}
