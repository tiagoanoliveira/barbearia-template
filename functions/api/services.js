import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { env } = context
  if (context.request.method === 'OPTIONS') return corsOptions()

  try {
    const { results: services } = await env.DB.prepare(
        'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color FROM servicos ORDER BY id'
    ).all()

    // Apenas overrides com preco explícito (não NULL) e activos
    // Barbeiros sem override ou com preco=NULL praticam o preço base
    const { results: overrides } = await env.DB.prepare(
        `SELECT sb.servico_id,
                MIN(sb.preco) AS min_override,
                MAX(sb.preco) AS max_override
         FROM servico_barbeiro sb
         WHERE sb.ativo = 1
           AND sb.preco IS NOT NULL
         GROUP BY sb.servico_id`
    ).all()

    const overrideMap = {}
    for (const o of overrides) overrideMap[o.servico_id] = o

    return ok(services.map(s => {
      const ov = overrideMap[s.id]

      if (!ov) {
        // Nenhum barbeiro tem preço personalizado → sem variação
        return { ...s, min_price: s.price, has_price_variation: false }
      }

      // Preço mínimo efectivo = menor entre overrides explícitos E preço base
      // (os barbeiros sem override praticam o preço base)
      const minPrice = Math.min(ov.min_override, s.price)
      const maxPrice = Math.max(ov.max_override, s.price)

      // Só há variação se min e max efectivos forem diferentes
      const hasPriceVariation = minPrice !== maxPrice

      return { ...s, min_price: minPrice, has_price_variation: hasPriceVariation }
    }))
  } catch (e) {
    return serverError('Erro ao carregar serviços', e.message)
  }
}