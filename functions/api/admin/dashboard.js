import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  try {
    const today = new Date().toISOString().split('T')[0]

    const [todayRes, weekRes, monthRes, totalClients, unreadNotifs] = await Promise.all([
      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM reservas
           WHERE date(data_hora) = ? AND status NOT IN ('cancelada')`
      ).bind(today).first(),

      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM reservas
           WHERE date(data_hora) BETWEEN date(?) AND date(?, '+6 days')
             AND status NOT IN ('cancelada')`
      ).bind(today, today).first(),

      env.DB.prepare(
        `SELECT COUNT(*) AS count FROM reservas
           WHERE strftime('%Y-%m', data_hora) = strftime('%Y-%m', 'now')
             AND status NOT IN ('cancelada')`
      ).first(),

      env.DB.prepare('SELECT COUNT(*) AS count FROM clientes').first(),

      env.DB.prepare(
        'SELECT COUNT(*) AS count FROM notifications WHERE is_read = 0'
      ).first(),
    ])

    return ok({
      today:               todayRes?.count        ?? 0,
      week:                weekRes?.count         ?? 0,
      month:               monthRes?.count        ?? 0,
      total_clients:       totalClients?.count    ?? 0,
      unread_notifications: unreadNotifs?.count   ?? 0,
    })
  } catch (e) {
    return serverError('Erro ao carregar dashboard', e.message)
  }
}
