import { verifyPassword } from '../../utils/crypto.js'
import { signJWT } from '../../utils/jwt.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const body = await request.json()

    const raw      = body.identifier ?? body.email ?? ''
    const password = body.password   ?? ''

    if (!raw || !password) return badRequest('Identificador e password são obrigatórios')

    const identifier = sanitize(raw, 200).toLowerCase().trim()

    // Primeiro tenta por email, depois por telefone
    let client = await env.DB.prepare(
        `SELECT id, nome, email, telefone, password_hash, foto_perfil, email_verificado
       FROM clientes WHERE email = ?`
    ).bind(identifier).first()

    if (!client) {
      client = await env.DB.prepare(
          `SELECT id, nome, email, telefone, password_hash, foto_perfil, email_verificado
           FROM clientes
           WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
      ).bind(identifier).first()
    }

    if (!client) return badRequest('Credenciais inválidas')

    if (!client.password_hash) return badRequest('Credenciais inválidas')

    const valid = await verifyPassword(password, client.password_hash)
    if (!valid) return badRequest('Credenciais inválidas')

    // Bloquear login se o email ainda não foi verificado
    if (!client.email_verificado) {
      return unauthorized(
          'Por favor verifique o seu email antes de iniciar sessão. ' +
          'Verifique a caixa de entrada (e spam) do email com que se registou.'
      )
    }

    const token = await signJWT({ id: client.id, email: client.email }, env.JWT_SECRET)

    return ok({
      token,
      user: {
        id:        client.id,
        name:      client.nome,
        email:     client.email,
        photo_url: client.foto_perfil,
      },
    })
  } catch (e) {
    return serverError('Erro ao fazer login', e.message)
  }
}