/**
 * /api/admin/discounts — lista + criar (apenas admins)
 *
 * GET  /api/admin/discounts   → lista todos com filtros
 * POST /api/admin/discounts   → criar desconto (aceita cliente_ids[] para criar vários)
 *
 * Sub-rotas em ficheiros próprios (Cloudflare Pages Functions):
 *   functions/api/admin/discounts/[id].js         → PUT, DELETE /:id
 *   functions/api/admin/discounts/[id]/apply.js   → POST /:id/apply
 *   functions/api/admin/discounts/client/[id].js  → GET /client/:id
 */

import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET — lista com filtros ───────────────────────────────────────────────────
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

  query += ' ORDER BY d.grupo ASC, d.criado_em DESC'

  try {
    const { results } = await env.DB.prepare(query).bind(...args).all()
    // Parse servicos_ids JSON string back to array
    const mapped = results.map(r => ({
      ...r,
      servicos_ids: r.servicos_ids ? JSON.parse(r.servicos_ids) : [],
    }))
    return ok(mapped)
  } catch (e) {
    return serverError('Erro ao listar descontos', e.message)
  }
}

// ─── POST — criar desconto (suporta vários clientes → cria um por cliente) ─────
export async function onRequestPost({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body  = await request.json()
    const erros = validateDiscountBody(body)
    if (erros.length) return badRequest(erros.join('; '))

    // Normalize cliente_ids: aceita cliente_id (singular) ou cliente_ids (array)
    let clienteIds = []
    if (Array.isArray(body.cliente_ids) && body.cliente_ids.length > 0) {
      clienteIds = body.cliente_ids
    } else if (body.cliente_id != null) {
      clienteIds = [body.cliente_id]
    } else {
      clienteIds = [null] // desconto geral
    }

    // Se mais do que 1 cliente, gera grupo automático se não vier definido
    const grupo = body.grupo || (clienteIds.length > 1
      ? `grupo-${Date.now()}`
      : null)

    const servicosJson = Array.isArray(body.servicos_ids) && body.servicos_ids.length > 0
      ? JSON.stringify(body.servicos_ids)
      : null

    const now = new Date().toISOString()
    const created = []

    for (const cid of clienteIds) {
      const { results } = await env.DB.prepare(`
        INSERT INTO descontos
          (cliente_id, nome, descricao, tipo, origem,
           valor_percentagem, valor_fixo_centimos,
           valido_de, valido_ate,
           min_reservas, min_reservas_periodo,
           grupo, regra_tipo, regra_detalhe, servicos_ids,
           max_usos, ativo, criado_por_admin_id, criado_em, atualizado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        RETURNING *
      `).bind(
        cid                          ?? null,
        body.nome,
        body.descricao               ?? null,
        body.tipo,
        body.origem                  ?? 'manual',
        body.valor_percentagem       ?? null,
        body.valor_fixo_centimos     ?? null,
        body.valido_de               ?? null,
        body.valido_ate              ?? null,
        body.min_reservas            ?? null,
        body.min_reservas_periodo    ?? null,
        grupo,
        body.regra_tipo              ?? null,
        body.regra_detalhe           ?? null,
        servicosJson,
        body.max_usos                ?? null,
        body.ativo !== undefined ? (body.ativo ? 1 : 0) : 1,
        adminAuth.adminId,
        now,
        now,
      ).all()
      created.push(results[0])
    }

    return ok(created.length === 1 ? created[0] : created, 201)
  } catch (e) {
    return serverError('Erro ao criar desconto', e.message)
  }
}

// ─── Validação partilhada ──────────────────────────────────────────────────────
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
  if (body.min_reservas != null && (typeof body.min_reservas !== 'number' || body.min_reservas < 0))
    erros.push('min_reservas deve ser um número >= 0')
  return erros
}

export { validateDiscountBody }
