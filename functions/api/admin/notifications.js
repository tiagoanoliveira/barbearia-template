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
  if (request.method === 'GET') {
    try {
      const url    = new URL(request.url)
      const unread = url.searchParams.get('unread') === 'true'
      const since  = url.searchParams.get('since')

      // Barbeiros só podem ver as próprias notificações
      const effectiveBarberId = isBarber && barberIdDb
          ? barberIdDb
          : (url.searchParams.get('barber_id') || null)

      const buildWhere = (baseParts = []) => {
        const parts = [...baseParts]
        if (effectiveBarberId) {
          parts.push('(barber_id = ? OR barber_id IS NULL)')
        }
        if (since) {
          parts.push('datetime(created_at) > datetime(?)')
        }
        return parts
      }

      const buildParams = (extra = []) => {
        const p = [...extra]
        if (effectiveBarberId) p.push(effectiveBarberId)
        if (since) p.push(since)
        return p
      }

      let results

      if (unread) {
        // Polling: apenas não lidas dos últimos 7 dias — usa a view optimizada
        const where  = buildWhere()
        const params = buildParams()
        const query  = `SELECT * FROM v_notifications_unread${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`
        const res    = await env.DB.prepare(query).bind(...params).all()
        results      = res.results
      } else {
        // Painel: não lidas (7 dias) + lidas (24h) — UNION das duas views
        const whereUnread  = buildWhere()
        const whereLidas   = buildWhere()
        const paramsUnread = buildParams()
        const paramsLidas  = buildParams()

        const unreadQuery = `SELECT * FROM v_notifications_unread${whereUnread.length ? ' WHERE ' + whereUnread.join(' AND ') : ''}`
        const lidasQuery  = `SELECT * FROM v_notifications_recent${whereLidas.length  ? ' WHERE ' + whereLidas.join(' AND ') + ' AND is_read = 1' : ' WHERE is_read = 1'}`

        const [unreadRes, lidasRes] = await Promise.all([
          env.DB.prepare(unreadQuery).bind(...paramsUnread).all(),
          env.DB.prepare(lidasQuery).bind(...paramsLidas).all(),
        ])

        // Juntar, remover duplicados (um item pode aparecer nos dois se a view sobreponha), ordenar
        const seen = new Set()
        results = [...(unreadRes.results ?? []), ...(lidasRes.results ?? [])]
            .filter(n => { if (seen.has(n.id)) return false; seen.add(n.id); return true })
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      }

      return ok(results)
    } catch (e) {
      return serverError('Erro ao carregar notificações', e.message)
    }
  }

  // PATCH /api/admin/notifications
  if (request.method === 'PATCH') {
    try {
      const body = await request.json().catch(() => ({}))
      const id   = body?.id

      if (id) {
        const unread = body?.unread === true
        const { success } = await env.DB.prepare(
            isBarber && barberIdDb
                ? 'UPDATE notifications SET is_read = ? WHERE id = ? AND (barber_id = ? OR barber_id IS NULL)'
                : 'UPDATE notifications SET is_read = ? WHERE id = ?'
        ).bind(
            ...(isBarber && barberIdDb
                ? [unread ? 0 : 1, id, barberIdDb]
                : [unread ? 0 : 1, id])
        ).run()

        if (!success) return serverError('Não foi possível atualizar a notificação', 'update_failed')
        return ok({ message: unread ? 'Notificação marcada como não lida' : 'Notificação marcada como lida' })
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
