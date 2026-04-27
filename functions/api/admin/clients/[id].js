import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (!Number.isFinite(id) || id < 1) return badRequest('ID inválido')

  if (request.method === 'GET') {
    try {
      const [client, { results: reservations }] = await Promise.all([
        env.DB.prepare(
          `SELECT id, nome AS name, email, telefone AS phone, nif,
                  foto_perfil AS photo_url, reservas_concluidas,
                  reservas_gratuitas_disponiveis,
                  next_appointment_date, last_appointment_date, notas AS notes, criado_em AS created_at
           FROM clientes WHERE id = ?`
        ).bind(id).first(),
        env.DB.prepare(`
          SELECT id, data_hora, status, comentario, nota_privada,
                 servico_nome AS service_name, servico_preco AS service_price,
                 barbeiro_nome AS barber_name, barbeiro_color AS barber_color,
                 duracao_efetiva AS service_duration
          FROM v_reservas_complete
          WHERE cliente_id = ?
          ORDER BY data_hora DESC
          LIMIT 30
        `).bind(id).all(),
      ])

      if (!client) return notFound('Cliente não encontrado')
      return ok({ ...client, reservations })
    } catch (e) {
      return serverError('Erro ao carregar cliente', e.message)
    }
  }

  if (request.method === 'PATCH') {
    try {
      const body = await request.json()
      const updates = []
      const vals = []

      if (body.name !== undefined) {
        const name = sanitize(body.name ?? '', 255)
        if (!name) return badRequest('Nome do cliente é obrigatório')
        updates.push('nome = ?')
        vals.push(name)
      }
      if (body.email !== undefined) {
        updates.push('email = ?')
        vals.push(sanitize(body.email ?? '', 255) || null)
      }
      if (body.phone !== undefined) {
        updates.push('telefone = ?')
        vals.push(sanitize(body.phone ?? '', 50) || null)
      }
      if (body.nif !== undefined) {
        // Aceitar string vazia ou null para apagar o NIF
        const nifStr = String(body.nif ?? '').trim()
        if (nifStr === '' || body.nif === null) {
          updates.push('nif = ?')
          vals.push(null)
        } else {
          const nifNum = Number(nifStr)
          if (!Number.isFinite(nifNum) || nifNum < 100000000 || nifNum > 999999999) {
            return badRequest('NIF inválido')
          }
          updates.push('nif = ?')
          vals.push(nifNum)
        }
      }
      if (body.notes !== undefined) {
        updates.push('notas = ?')
        vals.push(body.notes === '' || body.notes === null ? null : sanitize(String(body.notes), 2000))
      }
      if (body.reservas_concluidas !== undefined) {
        const v = parseInt(body.reservas_concluidas)
        if (!Number.isFinite(v) || v < 0) return badRequest('Número de reservas concluídas inválido')
        updates.push('reservas_concluidas = ?')
        vals.push(v)
      }
      if (body.reservas_gratuitas_disponiveis !== undefined) {
        const v = parseInt(body.reservas_gratuitas_disponiveis)
        if (!Number.isFinite(v) || v < 0) return badRequest('Número de reservas gratuitas inválido')
        updates.push('reservas_gratuitas_disponiveis = ?')
        vals.push(v)
      }

      if (!updates.length) return badRequest('Nada para actualizar')

      updates.push('atualizado_em = CURRENT_TIMESTAMP')
      const result = await env.DB.prepare(
        `UPDATE clientes SET ${updates.join(', ')} WHERE id = ?`
      ).bind(...vals, id).run()

      if ((result.meta?.changes ?? 0) === 0) return notFound('Cliente não encontrado')

      const updated = await env.DB.prepare(
        `SELECT id, nome AS name, email, telefone AS phone, nif,
                foto_perfil AS photo_url, reservas_concluidas,
                reservas_gratuitas_disponiveis,
                next_appointment_date, last_appointment_date, notas AS notes, criado_em AS created_at
         FROM clientes WHERE id = ?`
      ).bind(id).first()

      return ok(updated)
    } catch (e) {
      return serverError('Erro ao actualizar cliente', e.message)
    }
  }

  if (request.method === 'DELETE') {
    try {
      const result = await env.DB.prepare('DELETE FROM clientes WHERE id = ?').bind(id).run()
      if ((result.meta?.changes ?? 0) === 0) return notFound('Cliente não encontrado')
      return ok({ message: 'Cliente eliminado' })
    } catch (e) {
      return serverError('Erro ao eliminar cliente', e.message)
    }
  }

  return badRequest('Método não suportado')
}
