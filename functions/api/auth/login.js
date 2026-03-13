import { verifyPassword } from '../../utils/crypto.js'
import { signJWT } from '../../utils/jwt.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { email, password } = await request.json()
    if (!email || !password) return badRequest('Email e password são obrigatórios')

    const emailClean = sanitize(email, 200).toLowerCase()

    const client = await env.DB.prepare(
      'SELECT id, nome, email, password_hash FROM clientes WHERE email = ?'
    ).bind(emailClean).first()

    if (!client) return unauthorized()

    const valid = await verifyPassword(password, client.password_hash)
    if (!valid)  return unauthorized()

    const token = await signJWT({ id: client.id, email: client.email }, env.JWT_SECRET)

    return ok({ token, user: { id: client.id, name: client.nome, email: client.email } })
  } catch (e) {
    return serverError('Erro ao fazer login', e.message)
  }
}
