/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 * Valida o token de reset e aplica a nova password.
 */
import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { hashPassword } from '../../utils/crypto.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { token, password } = await request.json()

    if (!token)    return badRequest('Token obrigatório')
    if (!password) return badRequest('Password obrigatória')
    if (password.length < 8) return badRequest('A password deve ter pelo menos 8 caracteres')

    // Verificar token
    const row = await env.DB.prepare(
        `SELECT id AS cliente_id, token_reset_expira AS expires_at
         FROM clientes WHERE token_reset_password = ? LIMIT 1`
    ).bind(token).first()

    if (!row) {
      return badRequest('Token inválido ou já utilizado')
    }

    if (new Date(row.expires_at) < new Date()) {
      await env.DB.prepare(
          `UPDATE clientes
           SET token_reset_password = NULL, token_reset_expira = NULL, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`
      ).bind(row.cliente_id).run()
      return badRequest('O link de recuperação expirou. Por favor, pede um novo.')
    }

    const newHash = await hashPassword(password)

    // Atualizar password e marcar auth_methods com 'password' se ainda não estiver
    const client = await env.DB.prepare(
      'SELECT auth_methods FROM clientes WHERE id = ?'
    ).bind(row.cliente_id).first()

    let authMethods = client?.auth_methods ?? ''
    if (!authMethods.includes('password')) {
      authMethods = authMethods ? `${authMethods},password` : 'password'
    }

    await env.DB.prepare(
        `UPDATE clientes
         SET password_hash = ?, auth_methods = ?, token_reset_password = NULL, token_reset_expira = NULL, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(newHash, authMethods, row.cliente_id).run()

    return ok({ message: 'Password alterada com sucesso. Já podes iniciar sessão.' })
  } catch (e) {
    console.error('[reset-password] Erro:', e)
    return serverError('Erro ao redefinir password', e.message)
  }
}
