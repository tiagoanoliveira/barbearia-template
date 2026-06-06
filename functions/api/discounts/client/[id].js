/**
 * /api/discounts/client/:id — descontos ativos de um cliente
 * Auth: admin ou o próprio cliente
 *
 * GET /api/discounts/client/:id
 *
 * Filtra por min_reservas/min_reservas_periodo (apenas reservas confirmadas/concluídas)
 * e colapsa por grupo (devolve apenas o melhor desconto de cada programa).
 */

import { authenticateAdmin, authenticateClient } from '../../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../../utils/response.js'

export async function onRequestOptions() {
  return corsOptions()
}

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────

function getPeriodoInicio(periodo) {
  const now = new Date()
  switch (periodo) {
    case 'semana':    { const d = new Date(now); d.setDate(d.getDate() - 6);   return d.toISOString() }
    case 'quinzena':  { const d = new Date(now); d.setDate(d.getDate() - 14);  return d.toISOString() }
    case 'mes':       return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    case 'trimestre': { const d = new Date(now); d.setMonth(d.getMonth() - 3); return d.toISOString() }
    case 'semestre':  { const d = new Date(now); d.setMonth(d.getMonth() - 6); return d.toISOString() }
    case 'ano':       { const d = new Date(now); d.setFullYear(d.getFullYear() - 1); return d.toISOString() }
    default:          return null
  }
}

async function contarReservasPorPeriodo(env, clientId, periodos) {
  const stats = {}
  for (const periodo of periodos) {
    const inicio = getPeriodoInicio(periodo)
    if (!inicio) continue
    const row = await env.DB.prepare(`
      SELECT COUNT(*) as n FROM reservas
      WHERE cliente_id = ?
        AND status IN ('confirmada','concluida')
        AND datetime(data_hora) >= datetime(?)
    `).bind(clientId, inicio).first()
    stats[periodo] = row?.n ?? 0
  }
  return stats
}

function melhorDesconto(a, b) {
  const pa = a.valor_percentagem ?? 0
  const pb = b.valor_percentagem ?? 0
  if (pa !== pb) return pa > pb ? a : b
  const fa = a.valor_fixo_centimos ?? 0
  const fb = b.valor_fixo_centimos ?? 0
  if (fa !== fb) return fa > fb ? a : b
  return a.criado_em > b.criado_em ? a : b
}

function filtrarEColapsarPorGrupo(rows, stats) {
  const filtrados = rows.filter(d => {
    if (d.min_reservas == null || d.min_reservas_periodo == null) return true
    return (stats[d.min_reservas_periodo] ?? 0) >= d.min_reservas
  })
  const semGrupo = filtrados.filter(d => !d.grupo)
  const porGrupo = new Map()
  for (const d of filtrados.filter(d => d.grupo)) {
    const prev = porGrupo.get(d.grupo)
    porGrupo.set(d.grupo, prev ? melhorDesconto(prev, d) : d)
  }
  return [...semGrupo, ...porGrupo.values()]
}

// ─── Handler ────────────────────────────────────────────────────────────────────────────
export async function onRequestGet({ request, env, params }) {
  const clientId = parseInt(params.id, 10)
  if (!clientId) return ok([])

  const adminAuth = await authenticateAdmin(request, env)
  if (!adminAuth.success) {
    const clientAuth = await authenticateClient(request, env)
    if (!clientAuth.success || clientAuth.clientId !== clientId) {
      return unauthorized()
    }
  }

  try {
    const { results } = await env.DB.prepare(`
      SELECT * FROM descontos
      WHERE cliente_id = ?
        AND ativo = 1
        AND (valido_de  IS NULL OR datetime(valido_de)  <= datetime('now'))
        AND (valido_ate IS NULL OR datetime(valido_ate) >= datetime('now'))
        AND (max_usos   IS NULL OR usos_feitos < max_usos)
      ORDER BY criado_em DESC
    `).bind(clientId).all()

    const periodos = [...new Set(
      results
        .filter(d => d.min_reservas != null && d.min_reservas_periodo != null)
        .map(d => d.min_reservas_periodo)
    )]

    const stats  = await contarReservasPorPeriodo(env, clientId, periodos)
    const finais = filtrarEColapsarPorGrupo(results, stats)

    return ok(finais)
  } catch (e) {
    return serverError('Erro ao listar descontos do cliente', e.message)
  }
}
