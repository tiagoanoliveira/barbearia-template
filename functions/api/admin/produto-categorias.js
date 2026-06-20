/**
 * /api/admin/produto-categorias — CRUD de categorias de produtos
 *
 * GET    /api/admin/produto-categorias        → lista todas
 * POST   /api/admin/produto-categorias        → criar (admin/superAdmin)
 * PUT    /api/admin/produto-categorias/:id    → editar (admin/superAdmin)
 * DELETE /api/admin/produto-categorias/:id   → eliminar (admin/superAdmin)
 *
 * Sub-rotas em:
 *   functions/api/admin/produto-categorias/[id].js
 */

import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET — lista todas as categorias ──────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url  = new URL(request.url)
  const ativo = url.searchParams.get('ativo')

  let query = 'SELECT * FROM produto_categorias WHERE 1=1'
  const args = []

  if (ativo !== null && ativo !== '') {
    query += ' AND ativo = ?'
    args.push(ativo === '1' || ativo === 'true' ? 1 : 0)
  }

  query += ' ORDER BY ordem ASC, nome ASC'

  try {
    const { results } = await env.DB.prepare(query).bind(...args).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar categorias', e.message)
  }
}

// ─── POST — criar categoria ────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body = await request.json()
    if (!body.nome || !body.nome.trim()) return badRequest('nome obrigatório')

    const now = new Date().toISOString()
    const { results } = await env.DB.prepare(`
      INSERT INTO produto_categorias (nome, descricao, ordem, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?)
      RETURNING *
    `).bind(
      body.nome.trim(),
      body.descricao ?? null,
      body.ordem     ?? 0,
      body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
      now,
      now
    ).all()

    return ok(results[0], 201)
  } catch (e) {
    return serverError('Erro ao criar categoria', e.message)
  }
}
