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

    // Aceita {identifier} (email ou telefone) ou {email} por compatibilidade
    const raw      = body.identifier ?? body.email ?? ''
    const password = body.password   ?? ''

    if (!raw || !password) return badRequest('Identificador e password são obrigatórios')

    const identifier = sanitize(raw, 200).toLowerCase().trim()

    // Primeiro tenta por email, depois por telefone
    let client = await env.DB.prepare(
      'SELECT id, nome, email, telefone, password_hash, foto_perfil FROM clientes WHERE email = ?'
    ).bind(identifier).first()

    if (!client) {
      // Normaliza telefone: remove espaços e caracteres não numéricos para comparar
      client = await env.DB.prepare(
        `SELECT id, nome, email, telefone, password_hash, foto_perfil
         FROM clientes WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
      ).bind(identifier).first()
    }

    if (!client) return badRequest('Credenciais inválidas')

    // Verifica password — pode ser null em contas OAuth puras
    if (!client.password_hash) {
      return badRequest('Credenciais inválidas')
    }

    const valid = await verifyPassword(password, client.password_hash)
    if (!valid) return badRequest('Credenciais inválidas')

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
