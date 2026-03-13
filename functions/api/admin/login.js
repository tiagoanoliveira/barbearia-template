import { verifyPassword } from '../../utils/crypto.js'
import { signJWT } from '../../utils/jwt.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { email, password } = await request.json()
    if (!email || !password) return badRequest('Email e password obrigatórios')

    const admin = await env.DB.prepare(
      'SELECT id, nome, email, password_hash FROM admins WHERE email = ?'
    ).bind(email.toLowerCase()).first()

    if (!admin) return unauthorized()

    const valid = await verifyPassword(password, admin.password_hash)
    if (!valid)  return unauthorized()

    const secret = env.JWT_ADMIN_SECRET ?? env.JWT_SECRET
    const token  = await signJWT(
      { id: admin.id, email: admin.email, role: 'admin' },
      secret,
      86400 * 7 // 7 dias
    )

    return ok({ token, user: { id: admin.id, name: admin.nome, email: admin.email, role: 'admin' } })
  } catch (e) {
    return serverError('Erro ao fazer login', e.message)
  }
}
