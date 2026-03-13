import { verifyJWT } from './jwt.js'
import { unauthorized } from './response.js'

/**
 * Extrai e valida JWT de cliente (cookie auth_token ou Bearer)
 */
export async function authenticateClient(request, env) {
  const token = extractToken(request)
  if (!token) return { success: false }

  try {
    const payload = await verifyJWT(token, env.JWT_SECRET)
    return { success: true, clientId: payload.id, role: 'client', payload }
  } catch {
    return { success: false }
  }
}

/**
 * Valida JWT de admin (Bearer header)
 */
export async function authenticateAdmin(request, env) {
  const token = extractToken(request)
  if (!token) return { success: false }

  try {
    const payload = await verifyJWT(token, env.JWT_ADMIN_SECRET ?? env.JWT_SECRET)
    if (payload.role !== 'admin') return { success: false }
    return { success: true, adminId: payload.id, payload }
  } catch {
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
