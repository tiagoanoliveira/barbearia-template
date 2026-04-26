/**
 * GET /api/admin/me
 * Devolve o utilizador admin autenticado com o role REAL da BD.
 * O frontend deve usar este endpoint em vez de confiar no localStorage.
 */
import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  return ok({
    id:          auth.user.id,
    username:    auth.user.username,
    name:        auth.user.nome,
    role:        auth.user.role,        // role REAL vindo da BD
    barbeiro_id: auth.user.barbeiro_id,
  })
}
