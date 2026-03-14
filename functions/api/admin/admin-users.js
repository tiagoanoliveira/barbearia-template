import { authenticateAdmin } from '../../utils/auth.js'
import { hashPassword } from '../../utils/crypto.js'
import { ok, created, badRequest, unauthorized, notFound, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

/**
 * GET  /api/admin/admin-users          – lista todos
 * POST /api/admin/admin-users          – cria novo
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // Só o role 'admin' pode gerir utilizadores
  if (auth.payload?.role !== 'admin') return unauthorized('Apenas admins podem gerir utilizadores')

  if (request.method === 'GET') {
    const { results } = await env.DB.prepare(
      `SELECT au.id, au.username, au.nome, au.role, au.ativo,
              au.barbeiro_id, b.nome AS barbeiro_nome,
              au.criado_em, au.ultimo_login
       FROM admin_users au
       LEFT JOIN barbeiros b ON au.barbeiro_id = b.id
       ORDER BY au.role DESC, au.nome`
    ).all()
    return ok(results)
  }

  if (request.method === 'POST') {
    const { username, password, nome, role, barbeiro_id } = await request.json()
    if (!username || !password || !nome || !role) {
      return badRequest('username, password, nome e role são obrigatórios')
    }
    if (!['admin', 'barbeiro'].includes(role)) {
      return badRequest('role inválido')
    }
    const password_hash = await hashPassword(password)
    try {
      const r = await env.DB.prepare(
        `INSERT INTO admin_users (username, password_hash, nome, role, barbeiro_id, ativo)
         VALUES (?, ?, ?, ?, ?, 1)`
      ).bind(
        sanitize(username, 50),
        password_hash,
        sanitize(nome, 100),
        role,
        barbeiro_id ? parseInt(barbeiro_id) : null
      ).run()
      return created({ id: r.meta.last_row_id })
    } catch (e) {
      if (e.message?.includes('UNIQUE')) return badRequest('Username já existe')
      throw e
    }
  }

  return badRequest('Método não suportado')
}
