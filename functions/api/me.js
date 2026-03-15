import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../utils/response.js'
import { hashPassword, verifyPassword, generateToken } from '../utils/crypto.js'
import { sanitize } from '../utils/validators.js'
import { buildVerificationEmail, sendEmail } from '../utils/email.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  // GET — perfil (colunas do schema original)
  if (request.method === 'GET') {
    try {
      const client = await env.DB.prepare(
        `SELECT id, nome, email, telefone, nif, foto_perfil,
                reservas_concluidas, next_appointment_date, last_appointment_date,
                criado_em, auth_methods, email_verificado
         FROM clientes WHERE id = ?`
      ).bind(auth.clientId).first()

      if (!client) return notFound('Cliente não encontrado')

      return ok({
        id:                      client.id,
        name:                    client.nome,
        email:                   client.email,
        phone:                   client.telefone,
        nif:                     client.nif,
        photo_url:               client.foto_perfil,
        completed_reservations:  client.reservas_concluidas,
        next_appointment:        client.next_appointment_date,
        last_appointment:        client.last_appointment_date,
        created_at:              client.criado_em,
        auth_methods:            client.auth_methods,
        email_verified:          !!client.email_verificado,
      })
    } catch (e) {
      return serverError('Erro ao carregar perfil', e.message)
    }
  }

  // PUT — actualizar perfil
  if (request.method === 'PUT') {
    try {
      const body = await request.json()
      const { name, email, phone, nif, current_password, new_password } = body

      if (!name) return badRequest('Nome é obrigatório')

      if (new_password) {
        if (!current_password) return badRequest('Password atual é necessária')
        if (new_password.length < 8) return badRequest('Nova password mínimo 8 caracteres')

        const clientPw = await env.DB.prepare(
          'SELECT password_hash FROM clientes WHERE id = ?'
        ).bind(auth.clientId).first()

        const valid = await verifyPassword(current_password, clientPw.password_hash)
        if (!valid) return badRequest('Password atual incorreta')

        const newHash = await hashPassword(new_password)
        await env.DB.prepare(
          'UPDATE clientes SET password_hash = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?'
        ).bind(newHash, auth.clientId).run()
      }

      const current = await env.DB.prepare(
        'SELECT nome, email FROM clientes WHERE id = ?'
      ).bind(auth.clientId).first()

      const newEmail = sanitize(email ?? '', 200).toLowerCase()
      const sameEmail = current.email === newEmail

      await env.DB.prepare(
        `UPDATE clientes
         SET nome = ?, email = ?, telefone = ?, nif = ?,
             ${sameEmail ? '' : 'email_verificado = 0,'}
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        sanitize(name, 100),
        newEmail,
        sanitize(phone ?? '', 30),
        nif ?? null,
        auth.clientId
      ).run()

      if (!sameEmail && newEmail) {
        const token   = generateToken()
        const expires = new Date(Date.now() + 86400000).toISOString()

        await env.DB.prepare(
          `INSERT OR REPLACE INTO email_verification_tokens (cliente_id, token, expires_at)
           VALUES (?, ?, ?)`
        ).bind(auth.clientId, token, expires).run()

        const { html } = buildVerificationEmail({ clientName: name, verifyToken: token })

        sendEmail(context, {
          to:      newEmail,
          subject: 'Confirme o seu novo email – Brooklyn Barbearia',
          html,
        }).catch(() => {})
      }

      return ok({ message: 'Perfil atualizado' })
    } catch (e) {
      return serverError('Erro ao atualizar perfil', e.message)
    }
  }

  return badRequest('Método não suportado')
}
