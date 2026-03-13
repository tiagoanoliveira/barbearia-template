import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, notFound, serverError, corsOptions } from '../../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // GET — listar (com filtros)
  if (request.method === 'GET') {
    try {
      const url    = new URL(request.url)
      const date   = url.searchParams.get('date')
      const status = url.searchParams.get('status')
      const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 200)
      const offset = parseInt(url.searchParams.get('offset') ?? '0')

      let where  = []
      let params = []

      if (date) { where.push('date(r.data_hora) = ?'); params.push(date) }
      if (status) { where.push('r.status = ?'); params.push(status) }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const { results } = await env.DB.prepare(`
        SELECT
          r.id, r.data_hora, r.status, r.comentario, r.duracao_minutos,
          c.id AS client_id,  c.nome AS client_name,  c.email AS client_email,  c.telefone AS client_phone,
          b.id AS barber_id,  b.nome AS barber_name,
          s.id AS service_id, s.nome AS service_name, s.preco AS price
        FROM reservas r
        JOIN clientes  c ON c.id = r.cliente_id
        JOIN barbeiros b ON b.id = r.barbeiro_id
        JOIN servicos  s ON s.id = r.servico_id
        ${whereClause}
        ORDER BY r.data_hora DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      return ok(results)
    } catch (e) {
      return serverError('Erro ao listar reservas', e.message)
    }
  }

  // POST — criar reserva manualmente (admin)
  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const { client_id, service_id, barber_id, date, time, notes } = body

      if (!isValidId(client_id))   return badRequest('ID do cliente inválido')
      if (!isValidId(service_id))  return badRequest('ID do serviço inválido')
      if (!isValidId(barber_id))   return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))      return badRequest('Data inválida')
      if (!isValidTime(time))      return badRequest('Hora inválida')

      const dataHora = `${date}T${time}:00`

      const service = await env.DB.prepare('SELECT duracao FROM servicos WHERE id = ?').bind(service_id).first()

      const result = await env.DB.prepare(
        `INSERT INTO reservas (cliente_id, barbeiro_id, servico_id, data_hora, comentario, duracao_minutos, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, 'admin', 'confirmada')`
      ).bind(
        client_id, barber_id, service_id,
        dataHora, sanitize(notes ?? '', 2000),
        service?.duracao || 60
      ).run()

      return created({ id: result.meta.last_row_id })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}
