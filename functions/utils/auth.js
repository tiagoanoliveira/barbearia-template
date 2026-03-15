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
 * Valida JWT de admin (Bearer header)
 * Neste template, o próprio acto de obter um token de admin já garante que
 * o utilizador vem de `admin_users`, por isso aqui apenas verificamos
 * a assinatura e extraímos o id.
 */
export async function authenticateAdmin(request, env) {
  const token = extractToken(request)
  if (!token) {
    console.warn('authenticateAdmin: nenhum token encontrado', request.url)
    return { success: false }
  }

  try {
    const payload = await verifyJWT(token, env.JWT_ADMIN_SECRET ?? env.JWT_SECRET)
    return { success: true, adminId: payload.id, payload }
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
