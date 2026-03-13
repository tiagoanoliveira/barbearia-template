import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // GET — listar (usa view v_notifications_unread)
  if (request.method === 'GET') {
    try {
      const url      = new URL(request.url)
      const unread   = url.searchParams.get('unread') === 'true'
      const barberId = url.searchParams.get('barber_id')

      let query  = ''
      let params = []

      if (unread) {
        // Usar view optimizada do schema original
        query = 'SELECT * FROM v_notifications_unread'
        if (barberId) { query += ' WHERE barber_id = ?'; params.push(barberId) }
      } else {
        query = `
          SELECT n.*, b.nome AS barber_name, b.color AS barber_color
          FROM notifications n
          LEFT JOIN barbeiros b ON n.barber_id = b.id
          ORDER BY n.created_at DESC
          LIMIT 50
        `
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()
      return ok(results)
    } catch (e) {
      return serverError('Erro ao carregar notificações', e.message)
    }
  }

  // PATCH /api/admin/notifications — marcar todas como lidas
  if (request.method === 'PATCH') {
    try {
      await env.DB.prepare(
        'UPDATE notifications SET is_read = 1 WHERE is_read = 0'
      ).run()
      return ok({ message: 'Todas as notificações marcadas como lidas' })
    } catch (e) {
      return serverError('Erro ao marcar notificações', e.message)
    }
  }

  return ok([])
}
