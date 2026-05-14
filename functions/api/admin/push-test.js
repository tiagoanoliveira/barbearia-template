import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

// Esta rota foi removida — mantida apenas como stub para não quebrar deploys em curso.
export async function onRequest(context) {
  const { request } = context
  if (request.method === 'OPTIONS') return corsOptions()
  const auth = await authenticateAdmin(request, context.env)
  if (!auth.success) return unauthorized()
  return badRequest('Rota de teste removida')
}
