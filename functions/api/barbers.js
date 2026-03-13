import { ok, serverError, corsOptions } from '../utils/response.js'

export async function onRequest(context) {
  const { env } = context
  if (context.request.method === 'OPTIONS') return corsOptions()

  try {
    const { results } = await env.DB.prepare(
      'SELECT id, nome AS name, foto_url AS photo_url, ativo AS active FROM barbeiros WHERE ativo = 1 ORDER BY nome'
    ).all()

    return ok(results)
  } catch (e) {
    return serverError('Erro ao carregar barbeiros', e.message)
  }
}
