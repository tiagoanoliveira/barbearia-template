/**
 * /api/admin/produto-vendas — Registo e listagem de vendas de produtos
 *
 * GET  /api/admin/produto-vendas   → lista vendas
 *   - superAdmin / admin : vêem todas; podem filtrar por admin_user_id
 *   - barbeiro           : vê apenas as suas próprias
 * POST /api/admin/produto-vendas   → registar nova venda
 */

import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET ────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url = new URL(request.url)

  const dataInicio  = url.searchParams.get('data_inicio')
  const dataFim     = url.searchParams.get('data_fim')
  const adminUserId = url.searchParams.get('admin_user_id')
  const clienteId   = url.searchParams.get('cliente_id')
  const limit       = parseInt(url.searchParams.get('limit')  || '100')
  const offset      = parseInt(url.searchParams.get('offset') || '0')

  let query = `
    SELECT
      pv.id, pv.total_centimos, pv.meio_pagamento, pv.notas, pv.criado_em,
      pv.gorjeta, pv.meio_gorjeta,
      pv.oferta_tipo, pv.oferta_valor,
      pv.admin_user_id, au.nome AS admin_user_nome,
      pv.cliente_id, c.nome AS cliente_nome, c.telefone AS cliente_telefone
    FROM produto_vendas pv
    JOIN admin_users au ON pv.admin_user_id = au.id
    LEFT JOIN clientes c ON pv.cliente_id = c.id
    WHERE 1=1
  `
  const args = []

  // Barbeiros só vêem as suas próprias vendas.
  // Admin e superAdmin vêem tudo e podem filtrar por admin_user_id.
  if (adminAuth.role === 'barbeiro') {
    query += ' AND pv.admin_user_id = ?'
    args.push(adminAuth.adminId)
  } else if (adminUserId) {
    query += ' AND pv.admin_user_id = ?'
    args.push(parseInt(adminUserId))
  }

  if (clienteId)  { query += ' AND pv.cliente_id = ?';             args.push(parseInt(clienteId)) }
  if (dataInicio) { query += ' AND date(pv.criado_em) >= date(?)'; args.push(dataInicio) }
  if (dataFim)    { query += ' AND date(pv.criado_em) <= date(?)'; args.push(dataFim) }

  query += ' ORDER BY pv.criado_em DESC LIMIT ? OFFSET ?'
  args.push(limit, offset)

  try {
    const { results: vendas } = await env.DB.prepare(query).bind(...args).all()

    if (vendas.length > 0) {
      const vendaIds     = vendas.map(v => v.id)
      const placeholders = vendaIds.map(() => '?').join(',')
      const { results: itens } = await env.DB.prepare(`
        SELECT
          pvi.venda_id, pvi.produto_id, pvi.quantidade, pvi.preco_unitario_centimos,
          pvi.oferta,
          p.nome AS produto_nome, pc.nome AS categoria_nome
        FROM produto_venda_itens pvi
        JOIN produtos p ON pvi.produto_id = p.id
        JOIN produto_categorias pc ON p.categoria_id = pc.id
        WHERE pvi.venda_id IN (${placeholders})
      `).bind(...vendaIds).all()

      const itensPorVenda = {}
      for (const item of itens) {
        if (!itensPorVenda[item.venda_id]) itensPorVenda[item.venda_id] = []
        itensPorVenda[item.venda_id].push(item)
      }
      for (const venda of vendas) {
        venda.itens = itensPorVenda[venda.id] || []
      }
    }

    return ok(vendas)
  } catch (e) {
    return serverError('Erro ao listar vendas', e.message)
  }
}

// ─── POST ─────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body = await request.json()

    if (!body.meio_pagamento)                             return badRequest('meio_pagamento obrigatório')
    if (!Array.isArray(body.itens) || !body.itens.length) return badRequest('itens obrigatório e não pode ser vazio')

    for (const item of body.itens) {
      if (!item.produto_id)                        return badRequest('produto_id obrigatório em cada item')
      if (!item.quantidade || item.quantidade < 1) return badRequest('quantidade deve ser >= 1')
    }

    const gorjeta = body.gorjeta != null ? Number(body.gorjeta) : null
    if (gorjeta !== null && (!Number.isFinite(gorjeta) || gorjeta < 0))
      return badRequest('gorjeta deve ser um número não-negativo (cêntimos)')
    const meioGorjeta = (gorjeta && gorjeta > 0) ? (body.meio_gorjeta ?? null) : null

    const adminUserId = body.admin_user_id ? parseInt(body.admin_user_id) : adminAuth.adminId

    if (adminUserId !== adminAuth.adminId) {
      const { results: adminCheck } = await env.DB.prepare(
        'SELECT id FROM admin_users WHERE id = ?'
      ).bind(adminUserId).all()
      if (!adminCheck.length) return badRequest('admin_user_id não encontrado')
    }

    const prodIds      = [...new Set(body.itens.map(i => i.produto_id))]
    const placeholders = prodIds.map(() => '?').join(',')
    const { results: produtos } = await env.DB.prepare(
      `SELECT id, preco_centimos, ativo FROM produtos WHERE id IN (${placeholders})`
    ).bind(...prodIds).all()

    const prodMap = Object.fromEntries(produtos.map(p => [p.id, p]))

    let totalCentimos = 0
    const itensParaInserir = []

    for (const item of body.itens) {
      const prod = prodMap[item.produto_id]
      if (!prod)       return badRequest(`Produto ${item.produto_id} não encontrado`)
      if (!prod.ativo) return badRequest(`Produto ${item.produto_id} está inativo`)

      const precoUnitario = item.preco_unitario_centimos ?? prod.preco_centimos
      const eOferta       = item.oferta === true || item.oferta === 1
      if (!eOferta) totalCentimos += precoUnitario * item.quantidade
      itensParaInserir.push({ ...item, preco_unitario_centimos: precoUnitario, oferta: eOferta ? 1 : 0 })
    }

    const now = new Date().toISOString()

    const { results: vendaResult } = await env.DB.prepare(`
      INSERT INTO produto_vendas
        (admin_user_id, cliente_id, total_centimos, meio_pagamento, notas,
         gorjeta, meio_gorjeta, oferta_tipo, oferta_valor, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      adminUserId,
      body.cliente_id   ?? null,
      totalCentimos,
      body.meio_pagamento,
      body.notas        ?? null,
      gorjeta,
      meioGorjeta,
      body.oferta_tipo  ?? null,
      body.oferta_valor ?? null,
      now
    ).all()

    const venda = vendaResult[0]

    for (const item of itensParaInserir) {
      await env.DB.prepare(`
        INSERT INTO produto_venda_itens (venda_id, produto_id, quantidade, preco_unitario_centimos, oferta)
        VALUES (?, ?, ?, ?, ?)
      `).bind(venda.id, item.produto_id, item.quantidade, item.preco_unitario_centimos, item.oferta).run()
    }

    venda.itens = itensParaInserir
    return ok(venda, 201)
  } catch (e) {
    return serverError('Erro ao registar venda', e.message)
  }
}
