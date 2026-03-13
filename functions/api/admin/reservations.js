import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, notFound, serverError, corsOptions } from '../../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    try {
      const url    = new URL(request.url)
      const date   = url.searchParams.get('date')
      const status = url.searchParams.get('status')
      const limit  = Math.min(parseInt(url.searchParams.get('limit')  ?? '100'), 200)
      const offset = parseInt(url.searchParams.get('offset') ?? '0')

      let where  = []
      let params = []

      if (date)   { where.push('date(data_hora) = ?'); params.push(date) }
      if (status) { where.push('status = ?');          params.push(status) }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      // Usar v_reservas_complete
      const { results } = await env.DB.prepare(`
        SELECT
          id, data_hora, status, comentario, nota_privada, duracao_efetiva,
          cliente_id,  cliente_nome,  cliente_email, cliente_telefone, cliente_nif,
          barbeiro_id, barbeiro_nome, barbeiro_color,
          servico_id,  servico_nome,  servico_preco
        FROM v_reservas_complete
        ${whereClause}
        ORDER BY data_hora DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all()

      return ok(results)
    } catch (e) {
      return serverError('Erro ao listar reservas', e.message)
    }
  }

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
      const service  = await env.DB.prepare('SELECT duracao FROM servicos WHERE id = ?').bind(service_id).first()

      const result = await env.DB.prepare(
        `INSERT INTO reservas
           (cliente_id, barbeiro_id, servico_id, data_hora, comentario, duracao_minutos, created_by, status)
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
