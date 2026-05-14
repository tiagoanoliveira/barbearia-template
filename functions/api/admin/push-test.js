/**
 * /api/admin/push-test
 *
 * GET  — devolve as subscrições registadas para o admin autenticado
 *        (sem dados sensíveis — apenas endpoint truncado, user_agent, created_at)
 *
 * POST — dispara um push de teste imediato para todas as subscrições
 *        do admin autenticado e devolve o resultado de cada tentativa
 *
 * Útil para diagnosticar problemas de push sem ter de criar uma reserva.
 */
import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sendWebPush } from '../../utils/webpush.js'

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const db = env.DB

  // ─── GET: lista subscrições do admin ────────────────────────────────────────
  if (request.method === 'GET') {
    try {
      const { results } = await db.prepare(
        `SELECT
           id,
           substr(endpoint, 1, 40) || '...' AS endpoint_preview,
           length(endpoint) AS endpoint_len,
           user_agent,
           created_at
         FROM push_subscriptions
         WHERE admin_user_id = ?
         ORDER BY created_at DESC`
      ).bind(auth.adminId).all()

      const pub  = env.VAPID_PUBLIC_KEY
      const priv = env.VAPID_PRIVATE_KEY

      return ok({
        vapid_configured: !!(pub && priv),
        vapid_public_key_preview: pub ? pub.slice(0, 20) + '...' : null,
        subscriptions_count: results.length,
        subscriptions: results,
      })
    } catch (e) {
      console.error('[push-test GET]', e?.message)
      return serverError('Erro ao listar subscrições')
    }
  }

  // ─── POST: dispara push de teste ────────────────────────────────────────────
  if (request.method === 'POST') {
    const pub     = env.VAPID_PUBLIC_KEY
    const priv    = env.VAPID_PRIVATE_KEY
    const subject = env.VAPID_SUBJECT ?? 'mailto:admin@barbearia.pt'

    if (!pub || !priv) {
      return ok({
        error: 'VAPID não configurado',
        detail: 'As variáveis de ambiente VAPID_PUBLIC_KEY e/ou VAPID_PRIVATE_KEY não estão definidas no Cloudflare.',
        results: []
      })
    }

    try {
      const { results: subs } = await db.prepare(
        `SELECT endpoint, p256dh, auth, user_agent
         FROM push_subscriptions
         WHERE admin_user_id = ?`
      ).bind(auth.adminId).all()

      if (!subs.length) {
        return ok({
          error: 'Sem subscrições',
          detail: 'Não existe nenhuma subscrição push registada para este utilizador. Clica em "Ativar push" no sino de notificações.',
          results: []
        })
      }

      const vapid = { publicKey: pub, privateKey: priv, subject }
      const testMsg = {
        title: '🔔 Teste Push',
        body:  'Se vês esta notificação, o push está a funcionar!',
        url:   '/admin/dashboard',
        tag:   'push-test',
      }

      const outcomes = await Promise.allSettled(
        subs.map(async (s) => {
          const endpointPreview = s.endpoint.slice(0, 50) + '...'
          try {
            const result = await sendWebPush(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              testMsg,
              vapid
            )
            // Limpar subscrição expirada
            if (result.status === 410 || result.status === 404) {
              await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?')
                .bind(s.endpoint).run().catch(() => {})
            }
            return {
              endpoint:   endpointPreview,
              user_agent: s.user_agent,
              status:     result.status,
              statusText: result.statusText,
              body:       result.body,
              success:    result.status === 201 || result.status === 200,
            }
          } catch (err) {
            return {
              endpoint:   endpointPreview,
              user_agent: s.user_agent,
              status:     0,
              error:      err?.message ?? 'Erro desconhecido',
              success:    false,
            }
          }
        })
      )

      const results = outcomes.map(o => o.status === 'fulfilled' ? o.value : { success: false, error: o.reason?.message })
      const allOk   = results.every(r => r.success)
      const anyOk   = results.some(r => r.success)

      return ok({
        vapid_public_key_preview: pub.slice(0, 20) + '...',
        subscriptions_tested: subs.length,
        all_succeeded: allOk,
        any_succeeded: anyOk,
        results,
      })
    } catch (e) {
      console.error('[push-test POST]', e?.message)
      return serverError('Erro ao enviar push de teste')
    }
  }

  return serverError('Método não suportado')
}
