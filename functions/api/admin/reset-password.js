/**
 * POST /api/admin/reset-password
 *
 * Endpoint TEMPORÁRIO — sem autenticação — para corrigir hashes de passwords
 * de utilizadores cujas hashes ficaram incompatíveis.
 *
 * ⚠️  Remover (ou proteger com ALLOW_PASSWORD_RESET) assim que o problema
 *     estiver resolvido.
 */
import { hashPassword } from '../../utils/crypto.js'
import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  // Guarda de segurança opcional: só funciona se ALLOW_PASSWORD_RESET='1'
  // (deixar comentado para activar sem precisar de deploy de variável)
  // if (env.ALLOW_PASSWORD_RESET !== '1') return badRequest('Endpoint desactivado')

  try {
    const { username, newPassword } = await request.json()

    if (!username || !newPassword)
      return badRequest('username e newPassword são obrigatórios')

    if (newPassword.length < 6)
      return badRequest('A password deve ter pelo menos 6 caracteres')

    const user = await env.DB.prepare(
      'SELECT id, username, nome FROM admin_users WHERE username = ? AND ativo = 1'
    ).bind(username).first()

    if (!user) return badRequest('Utilizador não encontrado')

    const password_hash = await hashPassword(newPassword)

    await env.DB.prepare(
      'UPDATE admin_users SET password_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(password_hash, user.id).run()

    return ok({ message: `Password do utilizador "${user.nome}" actualizada com sucesso.` })
  } catch (e) {
    return serverError('Erro ao actualizar password', e.message)
  }
}
