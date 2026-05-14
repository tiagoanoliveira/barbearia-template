/**
 * /api/admin/push-subscription
 *
 * POST  — guarda ou actualiza uma subscrição Web Push para o admin autenticado
 * DELETE — remove a subscrição (unsubscribe)
 */
import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // ─── POST: subscrever ───────────────────────────────────────────────────────
  if (request.method === 'POST') {
    let body
    try {
      body = await request.json()
    } catch {
      return badRequest('JSON inválido')
    }

    const { endpoint, keys } = body ?? {}
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return badRequest('endpoint, keys.p256dh e keys.auth são obrigatórios')
    }

    const userAgent = request.headers.get('User-Agent') ?? null

    try {
      // UPSERT: se o endpoint já existe actualiza as chaves; senão insere
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (admin_user_id, endpoint, p256dh, auth, user_agent)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           p256dh     = excluded.p256dh,
           auth       = excluded.auth,
           user_agent = excluded.user_agent`
      )
        .bind(auth.adminId, endpoint, keys.p256dh, keys.auth, userAgent)
        .run()

      return created({ subscribed: true })
    } catch (e) {
      console.error('push-subscription POST:', e?.message)
      return serverError('Erro ao guardar subscrição')
    }
  }

  // ─── DELETE: dessubscrever ──────────────────────────────────────────────────
  if (request.method === 'DELETE') {
    let body
    try {
      body = await request.json()
    } catch {
      return badRequest('JSON inválido')
    }

    const { endpoint } = body ?? {}
    if (!endpoint) return badRequest('endpoint é obrigatório')

    try {
      await env.DB.prepare(
        `DELETE FROM push_subscriptions WHERE endpoint = ? AND admin_user_id = ?`
      )
        .bind(endpoint, auth.adminId)
        .run()

      return ok({ unsubscribed: true })
    } catch (e) {
      console.error('push-subscription DELETE:', e?.message)
      return serverError('Erro ao remover subscrição')
    }
  }

  return serverError('Método não suportado')
}
