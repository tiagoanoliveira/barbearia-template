import { verifyPassword } from '../../utils/crypto.js'
import { signJWT } from '../../utils/jwt.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { username, password } = await request.json()
    if (!username || !password) return badRequest('Username e password obrigatórios')

    // admin_users usa 'username' (não email) — schema original
    const admin = await env.DB.prepare(
      `SELECT id, username, nome, password_hash, role, barbeiro_id
       FROM admin_users WHERE username = ? AND ativo = 1`
    ).bind(username.toLowerCase()).first()

    if (!admin) return unauthorized()

    const valid = await verifyPassword(password, admin.password_hash)
    if (!valid)  return unauthorized()

    // Actualizar ultimo_login
    await env.DB.prepare(
      'UPDATE admin_users SET ultimo_login = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(admin.id).run()

    const secret = env.JWT_ADMIN_SECRET ?? env.JWT_SECRET
    const token  = await signJWT(
      { id: admin.id, username: admin.username, role: admin.role, barbeiro_id: admin.barbeiro_id },
      secret,
      86400 * 7
    )

    return ok({
      token,
      user: {
        id:          admin.id,
        username:    admin.username,
        name:        admin.nome,
        role:        admin.role,
        barbeiro_id: admin.barbeiro_id,
      },
    })
  } catch (e) {
    return serverError('Erro ao fazer login', e.message)
  }
}
