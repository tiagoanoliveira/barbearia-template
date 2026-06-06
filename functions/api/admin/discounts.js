/**
 * /api/admin/discounts — lista + criar (apenas admins)
 *
 * GET  /api/admin/discounts   → lista todos com filtros
 * POST /api/admin/discounts   → criar desconto
 *
 * Sub-rotas em ficheiros próprios (Cloudflare Pages Functions):
 *   functions/api/admin/discounts/[id].js         → PUT, DELETE /:id
 *   functions/api/admin/discounts/[id]/apply.js   → POST /:id/apply
 *   functions/api/admin/discounts/client/[id].js  → GET /client/:id
 */

import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export { validateDiscountBody }

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET — lista com filtros ──────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url      = new URL(request.url)
  const clientId = url.searchParams.get('cliente_id')
  const tipo     = url.searchParams.get('tipo')
  const ativo    = url.searchParams.get('ativo')

  let query  = 'SELECT d.*, c.nome AS cliente_nome FROM descontos d LEFT JOIN clientes c ON d.cliente_id = c.id WHERE 1=1'
  const args = []

  if (clientId) { query += ' AND d.cliente_id = ?'; args.push(parseInt(clientId)) }
  if (tipo)     { query += ' AND d.tipo = ?';       args.push(tipo) }
  if (ativo !== null && ativo !== undefined && ativo !== '') {
    query += ' AND d.ativo = ?'; args.push(ativo === '1' || ativo === 'true' ? 1 : 0)
  }

  query += ' ORDER BY d.criado_em DESC'

  try {
    const { results } = await env.DB.prepare(query).bind(...args).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos', e.message)
  }
}

// ─── POST — criar desconto ────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body  = await request.json()
    const erros = validateDiscountBody(body)
    if (erros.length) return badRequest(erros.join('; '))

    const now = new Date().toISOString()
    const { results } = await env.DB.prepare(`
      INSERT INTO descontos
        (cliente_id, nome, descricao, tipo, origem,
         valor_percentagem, valor_fixo_centimos,
         valido_de, valido_ate, min_reservas_mes,
         max_usos, ativo, criado_por_admin_id, criado_em, atualizado_em)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      RETURNING *
    `).bind(
      body.cliente_id          ?? null,
      body.nome,
      body.descricao           ?? null,
      body.tipo,
      body.origem              ?? 'manual',
      body.valor_percentagem   ?? null,
      body.valor_fixo_centimos ?? null,
      body.valido_de           ?? null,
      body.valido_ate          ?? null,
      body.min_reservas_mes    ?? null,
      body.max_usos            ?? null,
      body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
      adminAuth.adminId,
      now,
      now,
    ).all()

    return ok(results[0], 201)
  } catch (e) {
    return serverError('Erro ao criar desconto', e.message)
  }
}

// ─── Validação partilhada ─────────────────────────────────────────────────────
function validateDiscountBody(body, partial = false) {
  const erros = []
  if (!partial && !body.nome) erros.push('nome obrigatório')
  if (!partial && !body.tipo) erros.push('tipo obrigatório')
  if (body.valor_percentagem != null) {
    if (typeof body.valor_percentagem !== 'number' || body.valor_percentagem < 0 || body.valor_percentagem > 100)
      erros.push('valor_percentagem deve ser entre 0 e 100')
  }
  if (body.valor_fixo_centimos != null) {
    if (typeof body.valor_fixo_centimos !== 'number' || body.valor_fixo_centimos < 0)
      erros.push('valor_fixo_centimos deve ser positivo')
  }
  if (!partial && body.valor_percentagem == null && body.valor_fixo_centimos == null)
    erros.push('Deve indicar valor_percentagem ou valor_fixo_centimos')
  return erros
}
