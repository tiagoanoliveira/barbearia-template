import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../../utils/validators.js'
import { sendReservationConfirmation } from '../../utils/reservationEmails.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    try {
      const url      = new URL(request.url)
      const date     = url.searchParams.get('date')
      const dateFrom = url.searchParams.get('date_from')
      const dateTo   = url.searchParams.get('date_to')
      const status   = url.searchParams.get('status')
      const search   = url.searchParams.get('search') ?? ''
      const limitRaw = parseInt(url.searchParams.get('limit')  ?? '100')
      const offset   = parseInt(url.searchParams.get('offset') ?? '0')

      const limit    = Math.min(Number.isNaN(limitRaw) || limitRaw < 1 ? 100 : limitRaw, 200)
      const page     = Math.floor(offset / limit) + 1

      const where  = []
      const params = []

      if (date)     { where.push('date(data_hora) = ?');  params.push(date) }
      if (dateFrom) { where.push('date(data_hora) >= ?'); params.push(dateFrom) }
      if (dateTo)   { where.push('date(data_hora) <= ?'); params.push(dateTo) }
      if (status)   { where.push('status = ?');           params.push(status) }

      if (!date && !dateFrom && !dateTo) {
        const today = new Date().toISOString().slice(0, 10)
        where.push('date(data_hora) >= ?')
        params.push(today)
      }

      if (search) {
        where.push(
          '(cliente_nome LIKE ? OR cliente_email LIKE ? OR cliente_telefone LIKE ? OR servico_nome LIKE ?)',
        )
        const like = `%${search}%`
        params.push(like, like, like, like)
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM v_reservas_complete ${whereClause}`,
      ).bind(...params).first()

      const total      = totalRow?.count ?? 0
      const totalPages = Math.max(1, Math.ceil(total / limit))

      const { results } = await env.DB.prepare(
        `SELECT
           id,
           data_hora,
           status,
           comentario,
           nota_privada,
           duracao_efetiva      AS service_duration,
           cliente_id           AS client_id,
           cliente_nome         AS client_name,
           cliente_email        AS client_email,
           cliente_telefone     AS client_phone,
           cliente_nif          AS client_nif,
           barbeiro_id          AS barber_id,
           barbeiro_nome        AS barber_name,
           barbeiro_color       AS barber_color,
           servico_id           AS service_id,
           servico_nome         AS service_name,
           servico_preco        AS service_price
         FROM v_reservas_complete
         ${whereClause}
         ORDER BY data_hora ASC
         LIMIT ? OFFSET ?`,
      ).bind(...params, limit, offset).all()

      return ok({
        items: results,
        total,
        page,
        perPage: limit,
        totalPages,
      })
    } catch (e) {
      return serverError('Erro ao listar reservas', e.message)
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const {
        client_id,
        service_id,
        barber_id,
        date,
        time,
        notes,
        send_email,
      } = body

      if (!isValidId(client_id))   return badRequest('ID do cliente inválido')
      if (!isValidId(service_id))  return badRequest('ID do serviço inválido')
      if (!isValidId(barber_id))   return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))      return badRequest('Data inválida')
      if (!isValidTime(time))      return badRequest('Hora inválida')

      const dataHora = `${date}T${time}:00`
      const service  = await env.DB.prepare('SELECT duracao, nome FROM servicos WHERE id = ?').bind(service_id).first()
      const barber   = await env.DB.prepare('SELECT nome FROM barbeiros WHERE id = ?').bind(barber_id).first()
      const client   = await env.DB.prepare('SELECT nome, email FROM clientes WHERE id = ?').bind(client_id).first()
      const duracao  = service?.duracao || 60

      const result = await env.DB.prepare(
        `INSERT INTO reservas
           (cliente_id, barbeiro_id, servico_id, data_hora, comentario, duracao_minutos, created_by, status)
         VALUES (?, ?, ?, ?, ?, ?, 'admin', 'confirmada')`,
      ).bind(
        client_id, barber_id, service_id,
        dataHora, sanitize(notes ?? '', 2000),
        duracao,
      ).run()

      const reservaId = result.meta.last_row_id

      // Envia email de confirmação + agenda lembrete (apenas se send_email=true e cliente tem email)
      if (send_email && client?.email) {
        sendReservationConfirmation(context, {
          reservaId,
          clientEmail: client.email,
          clientName:  client.nome,
          dataHora,
          serviceName: service?.nome ?? 'Serviço',
          barberName:  barber?.nome  ?? 'Barbeiro',
          duracao,
          comentario:  notes ?? '',
        })
      }

      return created({ id: reservaId })
    } catch (e) {
      return serverError('Erro ao criar reserva', e.message)
    }
  }

  return badRequest('Método não suportado')
}
