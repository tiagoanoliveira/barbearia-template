import { ok, badRequest, unauthorized, corsOptions } from '../../../utils/response.js'
import { authenticateAdmin } from '../../../utils/auth.js'

/**
 * POST /api/admin/master-code/verify
 * Body: { code: string }
 * Header: Authorization: Bearer <admin_jwt>
 *
 * Verifica se o código de 8 dígitos corresponde a env.ADMIN_PANEL_CODE.
 * Requer autenticação admin normal (JWT) para evitar que qualquer pessoa tente.
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method !== 'POST') return badRequest('Método não suportado')

  const { code } = await request.json().catch(() => ({}))
  if (!code) return badRequest('Código obrigatório')

  const expected = env.ADMIN_PANEL_CODE ?? ''
  if (!expected) {
    // Se a variável não estiver definida, bloqueia sempre
    return unauthorized('ADMIN_PANEL_CODE não está configurado nas variáveis de ambiente')
  }

  // Comparação simples em tempo constante (evita timing attacks)
  let match = code.length === expected.length
  for (let i = 0; i < expected.length; i++) {
    if (code[i] !== expected[i]) match = false
  }

  if (!match) return unauthorized('Código incorreto')

  return ok({ verified: true })
}
