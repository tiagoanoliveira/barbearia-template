import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, unauthorized, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    try {
      const url     = new URL(request.url)
      const search  = url.searchParams.get('search') ?? ''
      const pageRaw = parseInt(url.searchParams.get('page') ?? '1')
      const perRaw  = parseInt(url.searchParams.get('perPage') ?? '20')

      const page    = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw
      const perPage = Math.min(Number.isNaN(perRaw) || perRaw < 1 ? 20 : perRaw, 100)
      const offset  = (page - 1) * perPage

      const where  = []
      const params = []

      if (search) {
        where.push('c.nome LIKE ? OR c.email LIKE ? OR c.telefone LIKE ?')
        const like = `%${search}%`
        params.push(like, like, like)
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
           c.criado_em   AS created_at
         FROM clientes c
         ${whereClause}
         ORDER BY c.nome COLLATE NOCASE
         LIMIT ? OFFSET ?`
      ).bind(...params, perPage, offset).all()

      return ok({
        items: results,
        total,
        page,
        perPage,
        totalPages,
      })
    } catch (e) {
      return serverError('Erro ao listar clientes', e.message)
    }
  }

  if (request.method === 'POST') {
    try {
      const body = await request.json()
      const name  = sanitize(body.name  ?? '', 255)
      const phone = sanitize(body.phone ?? '', 50).trim()

      if (!name)  return badRequest('Nome do cliente é obrigatório')
      if (!phone) return badRequest('Telefone do cliente é obrigatório')

      // Se não for fornecido email, gerar um placeholder com o telefone
      // para que o campo não fique nulo mas o sistema saiba que não é um email real.
      const rawEmail = sanitize(body.email ?? '', 255).trim()
      const email    = rawEmail || `${phone}@withoutcontact.pt`

      const result = await env.DB.prepare(
        `INSERT INTO clientes (nome, email, telefone, password_hash, email_verificado, criado_em, atualizado_em)
         VALUES (?, ?, ?, '', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(name, email, phone).run()

      const id = result.meta.last_row_id

      const createdClient = await env.DB.prepare(
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
           c.criado_em   AS created_at
         FROM clientes c
         WHERE c.id = ?`
      ).bind(id).first()

      return created(createdClient)
    } catch (e) {
      return serverError('Erro ao criar cliente', e.message)
    }
  }

  return badRequest('Método não suportado')
}
