import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { env } = context
  if (context.request.method === 'OPTIONS') return corsOptions()

  try {
    const { results: services } = await env.DB.prepare(
        'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color FROM servicos ORDER BY id'
    ).all()

    // Overrides activos com valores explícitos (não NULL)
    const { results: overrides } = await env.DB.prepare(
        `SELECT sb.servico_id,
                MIN(sb.preco)   AS min_override_price,
                MAX(sb.preco)   AS max_override_price,
                MIN(sb.duracao) AS min_override_duration,
                MAX(sb.duracao) AS max_override_duration
         FROM servico_barbeiro sb
         WHERE sb.ativo = 1
         GROUP BY sb.servico_id`
    ).all()

    const overrideMap = {}
    for (const o of overrides) overrideMap[o.servico_id] = o

    return ok(services.map(s => {
      const ov = overrideMap[s.id]

      if (!ov) {
        return {
          ...s,
          min_price:             s.price,
          has_price_variation:   false,
          min_duration:          s.duration,
          has_duration_variation: false,
        }
      }

      // ── Preço ────────────────────────────────────────────────────────────
      const minPrice = ov.min_override_price != null
          ? Math.min(ov.min_override_price, s.price)
          : s.price
      const maxPrice = ov.max_override_price != null
          ? Math.max(ov.max_override_price, s.price)
          : s.price
      const hasPriceVariation = minPrice !== maxPrice

      // ── Duração ───────────────────────────────────────────────────────────
      const minDuration = ov.min_override_duration != null
          ? Math.min(ov.min_override_duration, s.duration)
          : s.duration
      const maxDuration = ov.max_override_duration != null
          ? Math.max(ov.max_override_duration, s.duration)
          : s.duration
      const hasDurationVariation = minDuration !== maxDuration

      return {
        ...s,
        min_price:              minPrice,
        has_price_variation:    hasPriceVariation,
        min_duration:           minDuration,
        has_duration_variation: hasDurationVariation,
      }
    }))
  } catch (e) {
    return serverError('Erro ao carregar serviços', e.message)
  }
}