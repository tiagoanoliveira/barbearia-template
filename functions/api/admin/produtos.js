/**
 * /api/admin/produtos — CRUD de produtos
 *
 * GET  /api/admin/produtos        → lista todos (com categoria)
 * POST /api/admin/produtos        → criar produto (admin/superAdmin)
 *
 * Sub-rotas em:
 *   functions/api/admin/produtos/[id].js
 */

import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET — lista todos os produtos ────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url         = new URL(request.url)
  const categoriaId = url.searchParams.get('categoria_id')
  const ativo       = url.searchParams.get('ativo')

  let query = `
    SELECT p.*, pc.nome AS categoria_nome
    FROM produtos p
    JOIN produto_categorias pc ON p.categoria_id = pc.id
    WHERE 1=1
  `
  const args = []

  if (categoriaId) { query += ' AND p.categoria_id = ?'; args.push(parseInt(categoriaId)) }
  if (ativo !== null && ativo !== '') {
    query += ' AND p.ativo = ?'
    args.push(ativo === '1' || ativo === 'true' ? 1 : 0)
  }

  query += ' ORDER BY pc.ordem ASC, pc.nome ASC, p.ordem ASC, p.nome ASC'

  try {
    const { results } = await env.DB.prepare(query).bind(...args).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar produtos', e.message)
  }
}

// ─── POST — criar produto ──────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body  = await request.json()
    const erros = validateProdutoBody(body)
    if (erros.length) return badRequest(erros.join('; '))

    const now = new Date().toISOString()
    const { results } = await env.DB.prepare(`
      INSERT INTO produtos (categoria_id, nome, descricao, preco_centimos, ordem, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      body.categoria_id,
      body.nome.trim(),
      body.descricao        ?? null,
      body.preco_centimos   ?? 0,
      body.ordem            ?? 0,
      body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
      now,
      now
    ).all()

    return ok(results[0], 201)
  } catch (e) {
    return serverError('Erro ao criar produto', e.message)
  }
}

// ─── Validação ─────────────────────────────────────────────────────────────────
function validateProdutoBody(body, partial = false) {
  const erros = []
  if (!partial) {
    if (!body.nome || !body.nome.trim()) erros.push('nome obrigatório')
    if (!body.categoria_id)              erros.push('categoria_id obrigatório')
    if (body.preco_centimos == null)     erros.push('preco_centimos obrigatório')
  }
  if (body.preco_centimos != null && (typeof body.preco_centimos !== 'number' || body.preco_centimos < 0))
    erros.push('preco_centimos deve ser um número >= 0')
  return erros
}

export { validateProdutoBody }
