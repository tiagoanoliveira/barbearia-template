import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { env } = context
  if (context.request.method === 'OPTIONS') return corsOptions()

  try {
    const { results: services } = await env.DB.prepare(
        'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color FROM servicos ORDER BY id'
    ).all()

    // Para cada serviço: preço mínimo e máximo entre os barbeiros activos com override
    const { results: overrides } = await env.DB.prepare(
        `SELECT sb.servico_id,
                MIN(COALESCE(sb.preco, s.preco)) AS min_price,
                MAX(COALESCE(sb.preco, s.preco)) AS max_price
         FROM servico_barbeiro sb
                JOIN servicos s ON s.id = sb.servico_id
         WHERE sb.ativo = 1
         GROUP BY sb.servico_id`
    ).all()

    const overrideMap = {}
    for (const o of overrides) overrideMap[o.servico_id] = o

    return ok(services.map(s => {
      const ov = overrideMap[s.id]
      const minPrice = ov ? ov.min_price : s.price
      const hasPriceVariation = ov ? ov.min_price < ov.max_price || ov.min_price < s.price || ov.max_price < s.price : false
      return {
        ...s,
        min_price: minPrice,
        has_price_variation: hasPriceVariation,
      }
    }))
  } catch (e) {
    return serverError('Erro ao carregar serviços', e.message)
  }
}