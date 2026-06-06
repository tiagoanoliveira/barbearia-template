/**
 * /api/discounts — CRUD de descontos
 *
 * Rotas:
 *   GET  /api/discounts               → lista todos (admin)
 *   GET  /api/discounts/general        → descontos gerais ativos (público, sem auth)
 *   GET  /api/discounts/client/:id     → descontos de um cliente específico (admin ou próprio cliente)
 *   POST /api/discounts                → criar desconto (admin)
 *   PUT  /api/discounts/:id            → atualizar desconto (admin)
 *   DELETE /api/discounts/:id          → eliminar desconto (admin)
 *   POST /api/discounts/:id/apply      → aplicar desconto a uma reserva no checkout (admin)
 */

import { authenticateAdmin } from '../utils/auth.js'
import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../utils/response.js'

// ─── CORS preflight ──────────────────────────────────────────────────────────
export async function onRequestOptions() {
  return corsOptions()
}

// ─── GET ─────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url     = new URL(request.url)
  const pathRaw = url.pathname.replace(/^\/api\/discounts/, '')
  const path    = pathRaw.replace(/^\//, '')

  // GET /api/discounts/general — público, sem auth
  if (path === 'general') {
    return getGeneralDiscounts(env)
  }

  // GET /api/discounts/client/:id — admin ou próprio cliente
  const clientMatch = path.match(/^client\/(\d+)$/)
  if (clientMatch) {
    const clientId = parseInt(clientMatch[1])
    const adminAuth = await authenticateAdmin(request, env)
    if (!adminAuth.success) {
      const clientAuth = await authenticateClient(request, env)
      if (!clientAuth.success || clientAuth.clientId !== clientId) {
        return unauthorized()
      }
    }
    return getClientDiscounts(env, clientId)
  }

  // GET /api/discounts — lista todos (admin)
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

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

// ─── POST — criar desconto ou aplicar ────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  const url  = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/discounts\/?/, '')

  // POST /api/discounts/:id/apply — aplicar no checkout
  const applyMatch = path.match(/^(\d+)\/apply$/)
  if (applyMatch) {
    return applyDiscount(request, env, parseInt(applyMatch[1]))
  }

  // POST /api/discounts — criar
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const body = await request.json()
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
      body.cliente_id             ?? null,
      body.nome,
      body.descricao              ?? null,
      body.tipo,
      body.origem                 ?? 'manual',
      body.valor_percentagem      ?? null,
      body.valor_fixo_centimos    ?? null,
      body.valido_de              ?? null,
      body.valido_ate             ?? null,
      body.min_reservas_mes       ?? null,
      body.max_usos               ?? null,
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

// ─── PUT — atualizar desconto ─────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url   = new URL(request.url)
  const segs  = url.pathname.split('/').filter(Boolean)
  const id    = parseInt(segs[segs.length - 1])
  if (!id) return badRequest('ID inválido')

  try {
    const body  = await request.json()
    const erros = validateDiscountBody(body, true)
    if (erros.length) return badRequest(erros.join('; '))

    const now = new Date().toISOString()
    const { results } = await env.DB.prepare(`
      UPDATE descontos SET
        nome                   = COALESCE(?, nome),
        descricao              = ?,
        tipo                   = COALESCE(?, tipo),
        origem                 = ?,
        valor_percentagem      = ?,
        valor_fixo_centimos    = ?,
        valido_de              = ?,
        valido_ate             = ?,
        min_reservas_mes       = ?,
        max_usos               = ?,
        ativo                  = COALESCE(?, ativo),
        atualizado_em          = ?
      WHERE id = ?
      RETURNING *
    `).bind(
      body.nome                  ?? null,
      body.descricao             ?? null,
      body.tipo                  ?? null,
      body.origem                ?? null,
      body.valor_percentagem     ?? null,
      body.valor_fixo_centimos   ?? null,
      body.valido_de             ?? null,
      body.valido_ate            ?? null,
      body.min_reservas_mes      ?? null,
      body.max_usos              ?? null,
      body.ativo !== undefined ? (body.ativo ? 1 : 0) : null,
      now,
      id,
    ).all()

    if (!results.length) return notFound('Desconto não encontrado')
    return ok(results[0])
  } catch (e) {
    return serverError('Erro ao atualizar desconto', e.message)
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  const url = new URL(request.url)
  const id  = parseInt(url.pathname.split('/').filter(Boolean).pop())
  if (!id) return badRequest('ID inválido')

  try {
    await env.DB.prepare('DELETE FROM descontos WHERE id = ?').bind(id).run()
    return ok({ deleted: true })
  } catch (e) {
    return serverError('Erro ao eliminar desconto', e.message)
  }
}

// ─── Helpers privados ─────────────────────────────────────────────────────────

async function getGeneralDiscounts(env) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id IS NULL
        AND ativo = 1
        AND (valido_de  IS NULL OR datetime(valido_de)  <= datetime('now'))
        AND (valido_ate IS NULL OR datetime(valido_ate) >= datetime('now'))
        AND (max_usos   IS NULL OR usos_feitos < max_usos)
      ORDER BY criado_em DESC
    `).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos gerais', e.message)
  }
}

async function getClientDiscounts(env, clientId) {
  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id = ?
      ORDER BY ativo DESC, criado_em DESC
    `).bind(clientId).all()
    return ok(results)
  } catch (e) {
    return serverError('Erro ao listar descontos do cliente', e.message)
  }
}

/**
 * Aplicar desconto a uma reserva no checkout.
 * Se for ocasional (max_usos atingido após este uso), marca ativo = 0.
 */
async function applyDiscount(request, env, descontoId) {
  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) return unauthorized()

  try {
    const { reserva_id, oferta_valor } = await request.json()
    if (!reserva_id) return badRequest('reserva_id obrigatório')

    const desconto = await env.DB.prepare(
      'SELECT * FROM descontos WHERE id = ?'
    ).bind(descontoId).first()

    if (!desconto)       return notFound('Desconto não encontrado')
    if (!desconto.ativo) return badRequest('Desconto inativo')
    if (desconto.max_usos !== null && desconto.usos_feitos >= desconto.max_usos) {
      return badRequest('Desconto já esgotado')
    }

    const reserva = await env.DB.prepare(
      'SELECT data_hora, cliente_id FROM reservas WHERE id = ?'
    ).bind(reserva_id).first()
    if (!reserva) return notFound('Reserva não encontrada')

    const now      = new Date().toISOString()
    const novoUsos = desconto.usos_feitos + 1
    const esgotado = desconto.max_usos !== null && novoUsos >= desconto.max_usos
    const comentario = `Usado na reserva #${reserva_id} em ${reserva.data_hora}`

    // Atualizar reserva
    await env.DB.prepare(`
      UPDATE reservas
      SET desconto_id   = ?,
          oferta_valor  = COALESCE(?, oferta_valor),
          oferta_tipo   = ?,
          atualizado_em = ?
      WHERE id = ?
    `).bind(descontoId, oferta_valor ?? null, desconto.tipo, now, reserva_id).run()

    // Atualizar desconto
    await env.DB.prepare(`
      UPDATE descontos
      SET usos_feitos             = ?,
          usado_ultima_vez_em     = ?,
          usado_ultima_reserva_id = ?,
          comentario_uso          = ?,
          ativo                   = ?,
          atualizado_em           = ?
      WHERE id = ?
    `).bind(novoUsos, now, reserva_id, comentario, esgotado ? 0 : 1, now, descontoId).run()

    return ok({ desconto_id: descontoId, esgotado })
  } catch (e) {
    return serverError('Erro ao aplicar desconto', e.message)
  }
}

/**
 * Valida o body de criação/edição.
 * @param {boolean} partial — true em edições (PUT), campos opcionais
 */
function validateDiscountBody(body, partial = false) {
  const erros = []
  if (!partial && !body.nome) erros.push('nome obrigatório')
  if (!partial && !body.tipo) erros.push('tipo obrigatório')
  if (body.valor_percentagem != null) {
    if (typeof body.valor_percentagem !== 'number' || body.valor_percentagem < 0 || body.valor_percentagem > 100) {
      erros.push('valor_percentagem deve ser entre 0 e 100')
    }
  }
  if (body.valor_fixo_centimos != null) {
    if (typeof body.valor_fixo_centimos !== 'number' || body.valor_fixo_centimos < 0) {
      erros.push('valor_fixo_centimos deve ser positivo')
    }
  }
  if (!partial && body.valor_percentagem == null && body.valor_fixo_centimos == null) {
    erros.push('Deve indicar valor_percentagem ou valor_fixo_centimos')
  }
  return erros
}
