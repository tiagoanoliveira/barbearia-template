import { verifyJWT } from './jwt.js'

/**
 * Extrai e valida JWT de cliente (cookie auth_token ou Bearer)
 */
export async function authenticateClient(request, env) {
  const token = extractToken(request)
  if (!token) {
    console.warn('authenticateClient: nenhum token encontrado', request.url)
    return { success: false }
  }

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET)
    return { success: true, clientId: payload.id, role: 'client', payload }
  } catch (e) {
    console.error('authenticateClient: token inválido', request.url, e?.message)
    return { success: false }
  }
}

/**
 * Valida JWT de admin (Bearer header).
 * Vai buscar o registo completo de admin_users para expor role e barbeiro_id
 * a todos os endpoints que precisem de controlo de acesso por role.
 */
export async function authenticateAdmin(request, env) {
  const token = extractToken(request)
  if (!token) {
    console.warn('authenticateAdmin: nenhum token encontrado', request.url)
    return { success: false }
  }

  try {
    const payload = await verifyJWT(token, env.JWT_ADMIN_SECRET ?? env.JWT_SECRET)

    // Carregar dados completos do utilizador para ter role e barbeiro_id
    const adminUser = await env.DB.prepare(
      'SELECT id, username, nome, role, barbeiro_id, ativo FROM admin_users WHERE id = ?'
    ).bind(payload.id).first()

    if (!adminUser || !adminUser.ativo) {
      console.warn('authenticateAdmin: utilizador não encontrado ou inativo', payload.id)
      return { success: false }
    }

    return {
      success:  true,
      adminId:  adminUser.id,
      user:     adminUser,   // { id, username, nome, role, barbeiro_id, ativo }
      payload,
    }
  } catch (e) {
    console.error('authenticateAdmin: token inválido', request.url, e?.message)
    return { success: false }
  }
}

function extractToken(request) {
  // Authorization: Bearer <token>
  const authHeader = request.headers.get('Authorization') ?? ''
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7)

  // Cookie: auth_token=<token>
  const cookies = request.headers.get('Cookie') ?? ''
  const match   = cookies.match(/auth_token=([^;]+)/)
  return match ? match[1] : null
}
