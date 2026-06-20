import { authenticateAdmin } from '../../utils/auth.js'
import { isAdmin, isBarber } from '../../utils/authz.js'
import { ok, created, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  // Política de acesso por role:
  //   admin / superAdmin : GET, POST, PATCH, DELETE
  //   barbeiro           : GET (pesquisar clientes) + POST (criar cliente ao criar reserva)
  //                        PATCH e DELETE são exclusivos de admin
  const WRITE_ONLY_ADMIN_METHODS = ['PATCH', 'DELETE']

  if (!isAdmin(auth) && !isBarber(auth)) {
    console.warn('admin/clients: acesso negado', { role: auth.user?.role })
    return unauthorized('Sem permissões para aceder a clientes')
  }

  if (isBarber(auth) && WRITE_ONLY_ADMIN_METHODS.includes(request.method)) {
    console.warn('admin/clients: barbeiro tentou operação restrita', { method: request.method })
    return unauthorized('Barbeiros não podem editar ou eliminar clientes')
  }

  if (request.method === 'GET') {
    try {
      const url     = new URL(request.url)
      const search  = url.searchParams.get('search') ?? ''
      const pageRaw = parseInt(url.searchParams.get('page') ?? '1')
      const perRaw  = parseInt(url.searchParams.get('perPage') ?? '20')
      const blockedFilter = url.searchParams.get('blocked') ?? ''

      const page    = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
      const perPage = Math.min(Number.isNaN(perRaw) || perRaw < 1 ? 20 : perRaw, 100)
      const offset  = (page - 1) * perPage

      const where  = []
      const params = []

      if (search) {
        where.push('(c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?)')
        const like = `%${search}%`
        params.push(like, like, like)
      }

      if (blockedFilter === '1') {
        where.push('c.bloqueado = 1')
      } else if (blockedFilter === '0') {
        where.push('c.bloqueado = 0')
      }

      const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : ''

      const totalRow = await env.DB.prepare(
        `SELECT COUNT(*) AS count FROM clientes c ${whereClause}`
      ).bind(...params).first()

      const total      = totalRow?.count ?? 0
      const totalPages = Math.max(1, Math.ceil(total / perPage))

      const { results } = await env.DB.prepare(
        `SELECT
           c.id,
           c.nome        AS name,
           c.email,
           c.telefone    AS phone,
           c.nif,
           c.foto_perfil AS photo_url,
           c.reservas_concluidas,
           c.next_appointment_date,
           c.last_appointment_date,
           c.notas       AS notes,
           c.criado_em   AS created_at,
           c.bloqueado   AS blocked,
           c.bloqueado_motivo AS blocked_reason
         FROM clientes c
         ${whereClause}
         ORDER BY c.nome COLLATE NOCASE
         LIMIT ? OFFSET ?`
      ).bind(...params, perPage, offset).all()

      // Normalizar bloqueado para boolean
      const items = results.map(r => ({
        ...r,
        blocked: r.blocked === 1,
      }))

      return ok({ items, total, page, perPage, totalPages })
    } catch (e) {
      return serverError('Erro ao listar clientes', e.message)
    }
  }

  if (request.method === 'POST') {
    try {
      const body  = await request.json()
      const name  = sanitize(body.name  ?? '', 255)
      const phone = sanitize(body.phone ?? '', 50).trim()

      if (!name)  return badRequest('Nome do cliente é obrigatório')
      if (!phone) return badRequest('Telefone do cliente é obrigatório')

      const rawEmail = sanitize(body.email ?? '', 255).trim()
      const email    = rawEmail || `${phone}@withoutcontact.pt`

      const result = await env.DB.prepare(
        `INSERT INTO clientes (nome, email, telefone, password_hash, email_verificado, criado_em, atualizado_em)
         VALUES (?, ?, ?, 'cliente_nunca_iniciou_sessão', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(name, email, phone).run()

      const createdClient = await env.DB.prepare(
        `SELECT c.id, c.nome AS name, c.email, c.telefone AS phone,
                c.nif, c.foto_perfil AS photo_url, c.reservas_concluidas,
                c.next_appointment_date, c.last_appointment_date,
                c.notas AS notes, c.criado_em AS created_at,
                c.bloqueado AS blocked,
                c.bloqueado_motivo AS blocked_reason
         FROM clientes c WHERE c.id = ?`
      ).bind(result.meta.last_row_id).first()

      return created({
        ...createdClient,
        blocked: createdClient?.blocked === 1,
      })
    } catch (e) {
      return serverError('Erro ao criar cliente', e.message)
    }
  }

  return badRequest('Método não suportado')
}
