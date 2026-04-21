import { authenticateAdmin } from '../../utils/auth.js'
import { ok, unauthorized, serverError, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const isBarber   = auth.user?.role === 'barbeiro'
  const barberIdDb = auth.user?.barbeiro_id ?? null

  // GET — listar notificações
  // Suporta:
  //   - unread=true   → apenas não lidas (view optimizada)
  //   - since=ISO     → apenas após determinada data/hora (para polling eficiente)
  //   - barber_id     → filtro explícito (para admins)
  if (request.method === 'GET') {
    try {
      const url      = new URL(request.url)
      const unread   = url.searchParams.get('unread') === 'true'
      const since    = url.searchParams.get('since')
      const barberId = url.searchParams.get('barber_id')

      let query  = ''
      const params = []

      // Barbeiros só podem ver as próprias notificações — ignorar barber_id vindo do cliente
      const effectiveBarberId = isBarber && barberIdDb ? barberIdDb : barberId

      if (unread) {
        // View optimizada para não lidas, limitada aos últimos 7 dias
        query = 'SELECT * FROM v_notifications_unread'
        const whereParts = []
        if (effectiveBarberId) {
          whereParts.push('barber_id = ?')
          params.push(effectiveBarberId)
        }
        if (since) {
          whereParts.push('datetime(created_at) > datetime(?)')
          params.push(since)
        }
        if (whereParts.length) {
          query += ' WHERE ' + whereParts.join(' AND ')
        }
        query += ' ORDER BY created_at DESC'
      } else {
        // Últimas 50 notificações recentes (view limitada a 24h no schema)
        query = 'SELECT * FROM v_notifications_recent'
        const whereParts = []
        if (effectiveBarberId) {
          whereParts.push('barber_id = ?')
          params.push(effectiveBarberId)
        }
        if (since) {
          whereParts.push('datetime(created_at) > datetime(?)')
          params.push(since)
        }
        if (whereParts.length) {
          query += ' WHERE ' + whereParts.join(' AND ')
        }
        query += ' ORDER BY created_at DESC'
      }

      const { results } = await env.DB.prepare(query).bind(...params).all()
      return ok(results)
    } catch (e) {
      return serverError('Erro ao carregar notificações', e.message)
    }
  }

  // PATCH /api/admin/notifications
  //   - body { id }            → marcar uma notificação como lida
  //   - sem body / id ausente → marcar todas as notificações visíveis do utilizador como lidas
  if (request.method === 'PATCH') {
    try {
      const body = await request.json().catch(() => ({}))
      const id   = body?.id

      if (id) {
        // Marcar uma notificação específica como lida, respeitando role barbeiro
        const { success } = await env.DB.prepare(
          isBarber && barberIdDb
            ? 'UPDATE notifications SET is_read = 1 WHERE id = ? AND (barber_id = ? OR barber_id IS NULL)'
            : 'UPDATE notifications SET is_read = 1 WHERE id = ?'
        ).bind(...(isBarber && barberIdDb ? [id, barberIdDb] : [id])).run()

        if (!success) {
          return serverError('Não foi possível atualizar a notificação', 'update_failed')
        }

        return ok({ message: 'Notificação marcada como lida' })
      }

      // Marcar todas as notificações do utilizador como lidas
      if (isBarber && barberIdDb) {
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE is_read = 0 AND (barber_id = ? OR barber_id IS NULL)'
        ).bind(barberIdDb).run()
      } else {
        await env.DB.prepare(
          'UPDATE notifications SET is_read = 1 WHERE is_read = 0'
        ).run()
      }

      return ok({ message: 'Notificações marcadas como lidas' })
    } catch (e) {
      return serverError('Erro ao marcar notificações', e.message)
    }
  }

  return ok([])
}
