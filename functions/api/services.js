import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { env } = context
  if (context.request.method === 'OPTIONS') return corsOptions()

  try {
    // sem coluna 'ordem' nem 'ativo' no schema original
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color FROM servicos ORDER BY id'
    ).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar serviços', e.message)
  }
}
