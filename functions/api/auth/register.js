import { hashPassword } from '../../utils/crypto.js'
import { signJWT } from '../../utils/jwt.js'
import { ok, created, badRequest, conflict, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { name, email, phone, password } = await request.json()

    if (!name || !email || !password) return badRequest('Nome, email e password são obrigatórios')
    if (password.length < 8)          return badRequest('Password mínimo 8 caracteres')

    const emailClean = sanitize(email, 200).toLowerCase()

    // Verificar se email já existe
    const existing = await env.DB.prepare(
      'SELECT id FROM clientes WHERE email = ?'
    ).bind(emailClean).first()

    if (existing) return conflict('Email já registado')

    const hash = await hashPassword(password)

    const result = await env.DB.prepare(
      'INSERT INTO clientes (nome, email, telefone, password_hash) VALUES (?, ?, ?, ?)'
    ).bind(sanitize(name, 100), emailClean, sanitize(phone ?? '', 30), hash).run()

    const clientId = result.meta.last_row_id
    const token    = await signJWT({ id: clientId, email: emailClean }, env.JWT_SECRET)

    return created({ token, user: { id: clientId, name: sanitize(name, 100), email: emailClean } })
  } catch (e) {
    return serverError('Erro ao registar', e.message)
  }
}
