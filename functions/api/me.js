import { authenticateClient } from '../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../utils/response.js'
import { hashPassword, verifyPassword, generateToken } from '../utils/crypto.js'
import { sanitize } from '../utils/validators.js'
import { buildEmailChangeEmail, sendEmail } from '../utils/email.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  // GET — perfil
  if (request.method === 'GET') {
    try {
      const client = await env.DB.prepare(
        `SELECT id, nome, email, telefone, nif, foto_perfil,
                reservas_concluidas, next_appointment_date, last_appointment_date,
                criado_em, auth_methods, email_verificado
         FROM clientes WHERE id = ?`
      ).bind(auth.clientId).first()

      if (!client) return notFound('Cliente não encontrado')

      // Se há uma alteração de email pendente, informar o frontend
      const pendingChange = await env.DB.prepare(
        `SELECT new_email FROM email_change_tokens
         WHERE cliente_id = ? AND expires_at > datetime('now')
         ORDER BY criado_em DESC LIMIT 1`
      ).bind(auth.clientId).first().catch(() => null)

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
        pending_email_change:    pendingChange?.new_email ?? null,
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

      // Alteração de password
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

      // Atualizar nome, telefone, NIF (sem tocar no email diretamente)
      const current = await env.DB.prepare(
        'SELECT nome, email FROM clientes WHERE id = ?'
      ).bind(auth.clientId).first()

      const newEmail    = email ? sanitize(email, 200).toLowerCase() : current.email
      const emailChange = newEmail && newEmail !== current.email

      // Atualizar todos os campos exceto email (email só muda após confirmação)
      await env.DB.prepare(
        `UPDATE clientes
         SET nome = ?, telefone = ?, nif = ?,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(
        sanitize(name, 100),
        sanitize(phone ?? '', 30),
        nif ?? null,
        auth.clientId
      ).run()

      // Se o email mudou, gerar token de confirmação e enviar para o NOVO email
      if (emailChange) {
        const token   = generateToken()
        const expires = new Date(Date.now() + 86400000).toISOString() // 24h

        // Guardar na tabela de tokens de alteração de email
        // (cria a tabela se não existir — safe DDL inline)
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS email_change_tokens (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_id  INTEGER NOT NULL,
            token       TEXT    NOT NULL UNIQUE,
            new_email   TEXT    NOT NULL,
            expires_at  TEXT    NOT NULL,
            criado_em   TEXT    DEFAULT (datetime('now'))
          )
        `).run().catch(() => {})

        // Apagar tokens anteriores deste cliente
        await env.DB.prepare(
          'DELETE FROM email_change_tokens WHERE cliente_id = ?'
        ).bind(auth.clientId).run()

        await env.DB.prepare(
          'INSERT INTO email_change_tokens (cliente_id, token, new_email, expires_at) VALUES (?, ?, ?, ?)'
        ).bind(auth.clientId, token, newEmail, expires).run()

        const { html } = buildEmailChangeEmail({
          clientName:    current.nome,
          confirmToken:  token,
          newEmail,
        })

        sendEmail(context, {
          to:      newEmail,
          subject: 'Confirme o novo email – Brooklyn Barbearia',
          html,
        }).catch(err => console.error('[me] Erro ao enviar email de confirmação de alteração:', err))

        return ok({
          message: 'Perfil atualizado. Enviámos um email de confirmação para o novo endereço.',
          email_change_pending: true,
          pending_email: newEmail,
        })
      }

      return ok({ message: 'Perfil atualizado' })
    } catch (e) {
      return serverError('Erro ao atualizar perfil', e.message)
    }
  }

  return badRequest('Método não suportado')
}
