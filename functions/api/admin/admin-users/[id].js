import { authenticateAdmin } from '../../../utils/auth.js'
import { canManageAdminUsers } from '../../../utils/authz.js'
import { hashPassword } from '../../../utils/crypto.js'
import { ok, badRequest, unauthorized, notFound, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

/**
 * PUT    /api/admin/admin-users/:id  – editar
 * DELETE /api/admin/admin-users/:id  – eliminar
 */
export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // Usa auth.user.role (BD) — nunca auth.payload.role (JWT)
  if (!canManageAdminUsers(auth)) {
    return unauthorized('Apenas admins podem gerir utilizadores')
  }

  const id = parseInt(params.id)
  if (isNaN(id)) return badRequest('ID inválido')

  if (request.method === 'PUT') {
    const { username, password, nome, role, barbeiro_id, ativo } = await request.json()
    if (!username || !nome || !role) return badRequest('username, nome e role são obrigatórios')
    if (!['admin', 'barbeiro', 'superAdmin'].includes(role)) return badRequest('role inválido')

    // Impede que o próprio utilizador se desative
    if (auth.adminId === id && ativo === 0) {
      return badRequest('Não pode desativar a sua própria conta')
    }

    let query, binds
    if (password) {
      const password_hash = await hashPassword(password)
      query = `UPDATE admin_users SET username=?, password_hash=?, nome=?, role=?, barbeiro_id=?, ativo=?, atualizado_em=CURRENT_TIMESTAMP WHERE id=?`
      binds = [sanitize(username, 50), password_hash, sanitize(nome, 100), role, barbeiro_id ? parseInt(barbeiro_id) : null, ativo ?? 1, id]
    } else {
      query = `UPDATE admin_users SET username=?, nome=?, role=?, barbeiro_id=?, ativo=?, atualizado_em=CURRENT_TIMESTAMP WHERE id=?`
      binds = [sanitize(username, 50), sanitize(nome, 100), role, barbeiro_id ? parseInt(barbeiro_id) : null, ativo ?? 1, id]
    }

    try {
      const r = await env.DB.prepare(query).bind(...binds).run()
      if (r.meta.changes === 0) return notFound('Utilizador não encontrado')
      return ok({ updated: true })
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return badRequest('Username já existe')
      throw e
    }
  }

  if (request.method === 'DELETE') {
    if (auth.adminId === id) return badRequest('Não pode eliminar a sua própria conta')
    const r = await env.DB.prepare('DELETE FROM admin_users WHERE id=?').bind(id).run()
    if (r.meta.changes === 0) return notFound('Utilizador não encontrado')
    return ok({ deleted: true })
  }

  return badRequest('Método não suportado')
}
