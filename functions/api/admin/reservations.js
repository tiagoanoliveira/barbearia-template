import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { isValidDate, isValidTime, isValidId, sanitize } from '../../utils/validators.js'
import { sendReservationConfirmation } from '../../utils/reservationEmails.js'
import { isPlaceholderEmail } from '../../utils/email.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const user = auth.user

  if (request.method === 'GET') {
    try {
      const url      = new URL(request.url)
      const date     = url.searchParams.get('date')
      const dateFrom = url.searchParams.get('date_from')
      const dateTo   = url.searchParams.get('date_to')
      const status   = url.searchParams.get('status')
      const barberId = url.searchParams.get('barber_id')
      const search   = url.searchParams.get('search') ?? ''
      const limitRaw = parseInt(url.searchParams.get('limit')  ?? '100')
      const offset   = parseInt(url.searchParams.get('offset') ?? '0')

      const limit    = Math.min(Number.isNaN(limitRaw) || limitRaw < 1 ? 100 : limitRaw, 200)
      const page     = Math.floor(offset / limit) + 1

      const where  = []
      const params = []

      if (date)     { where.push('date(r.data_hora) = ?');  params.push(date) }
      if (dateFrom) { where.push('date(r.data_hora) >= ?'); params.push(dateFrom) }
      if (dateTo)   { where.push('date(r.data_hora) <= ?'); params.push(dateTo) }
      if (status)   { where.push('r.status = ?');           params.push(status) }
      if (barberId && user.role !== 'barbeiro') {
        where.push('r.barbeiro_id = ?')
        params.push(Number(barberId))
      }

      if (!date && !dateFrom && !dateTo) {
        const today = new Date().toISOString().slice(0, 10)
        where.push('date(r.data_hora) >= ?')
        params.push(today)
      }

      if (search) {
        where.push(
          '(r.cliente_nome LIKE ? OR r.cliente_email LIKE ? OR r.cliente_telefone LIKE ? OR r.servico_nome LIKE ?)',
        )
        const like = `%${search}%`
        params.push(like, like, like, like)
      }

      // Barbeiros só podem ver as suas próprias reservas
      if (user.role === 'barbeiro' && user.barbeiro_id) {
        where.push('r.barbeiro_id = ?')
        params.push(user.barbeiro_id)
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM v_reservas_complete r ${whereClause}`,
      ).bind(...params).first()

      const total      = totalRow?.count ?? 0
      const totalPages = Math.max(1, Math.ceil(total / limit))

      const { results } = await env.DB.prepare(
        `SELECT
           r.id,
           r.data_hora,
           r.status,
           r.comentario,
           r.nota_privada,
           r.duracao_efetiva           AS service_duration,
           r.created_by                AS created_by,
           r.cliente_id                AS client_id,
           r.cliente_nome              AS client_name,
           r.cliente_email             AS client_email,
           r.cliente_telefone          AS client_phone,
           r.cliente_nif               AS client_nif,
           r.barbeiro_id               AS barber_id,
           r.barbeiro_nome             AS barber_name,
           r.barbeiro_color            AS barber_color,
           r.servico_id                AS service_id,
           r.servico_nome              AS service_name,
           r.servico_preco             AS service_price,
           r.meio_pagamento,
           r.valor_pago,
           r.gorjeta,
           r.meio_gorjeta,
           r.comentario_pagamento,
           c.foto_perfil               AS client_photo_url,
           c.reservas_gratuitas_disponiveis AS client_free_reservations
          FROM v_reservas_complete r
          LEFT JOIN clientes c ON c.id = r.cliente_id
          ${whereClause}
          ORDER BY r.data_hora ASC
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
        service_duration,
        // Campo extra: novo email a aplicar antes de criar a reserva
        update_email,
      } = body

      if (!isValidId(client_id))   return badRequest('ID do cliente inválido')
      if (!isValidId(service_id))  return badRequest('ID do serviço inválido')
      if (!isValidId(barber_id))   return badRequest('ID do barbeiro inválido')
      if (!isValidDate(date))      return badRequest('Data inválida')
      if (!isValidTime(time))      return badRequest('Hora inválida')

      // Barbeiro só pode criar reservas para si próprio
      if (user.role === 'barbeiro' && user.barbeiro_id && user.barbeiro_id !== barber_id) {
        return unauthorized()
      }

      const dataHora = `${date}T${time}:00`
      const service  = await env.DB.prepare('SELECT duracao, nome FROM servicos WHERE id = ?').bind(service_id).first()
      const barber   = await env.DB.prepare('SELECT nome FROM barbeiros WHERE id = ?').bind(barber_id).first()
      let   client   = await env.DB.prepare('SELECT nome, email FROM clientes WHERE id = ?').bind(client_id).first()
      const customDuration = Number(service_duration)
      const hasCustomDuration = Number.isFinite(customDuration) && customDuration >= 5
      const duracao  = hasCustomDuration ? Math.round(customDuration) : (service?.duracao || 60)

      /**
       * Fluxo para clientes com email placeholder (@withoutcontact.pt):
       *
       *  1ª chamada (sem update_email):
       *     Se send_email=true E email é placeholder → não criar reserva ainda,
       *     devolver { requiresEmailUpdate: true } para o frontend mostrar o modal.
       *
       *  2ª chamada (com update_email preenchido):
       *     Atualizar o email do cliente na BD antes de criar a reserva.
       *     A reserva é criada com o novo email e os emails são enviados normalmente.
       *
       *  Caso o admin escolha "Confirmar sem emails" (send_email=false):
       *     A reserva é criada sem qualquer envio — sem modal.
       */
      const emailIsPlaceholder = isPlaceholderEmail(client?.email)

      if (send_email && emailIsPlaceholder && !update_email) {
        // Primeira chamada: avisar o frontend para mostrar o modal
        return ok({ requiresEmailUpdate: true })
      }

      // Se o admin forneceu um novo email válido, atualizar o cliente antes de criar a reserva
      if (update_email) {
        const newEmail = String(update_email).trim().toLowerCase()
        // Validação básica do formato de email
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail) || isPlaceholderEmail(newEmail)) {
          return badRequest('Email inválido')
        }
        await env.DB.prepare(
          'UPDATE clientes SET email = ? WHERE id = ?'
        ).bind(newEmail, client_id).run()
        // Reflectir o novo email para o envio imediato abaixo
        client = { ...client, email: newEmail }
      }

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

      // Enviar email de confirmação (apenas se send_email=true, cliente tem email real)
      // isPlaceholderEmail é verificado novamente dentro de sendReservationConfirmation
      // como proteção em profundidade.
      if (send_email && client?.email && !isPlaceholderEmail(client.email)) {
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
