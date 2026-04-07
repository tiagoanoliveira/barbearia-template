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
          `SELECT id, nome, email, email_pendente, telefone, nif, foto_perfil,
                  reservas_concluidas, next_appointment_date, last_appointment_date,
                  criado_em, auth_methods, email_verificado, token_verificacao_expira
           FROM clientes WHERE id = ?`
      ).bind(auth.clientId).first()

      if (!client) return notFound('Cliente não encontrado')

      let pendingEmail = null
      if (client.email_pendente && client.token_verificacao_expira) {
        if (new Date(client.token_verificacao_expira) > new Date()) {
          pendingEmail = client.email_pendente
        } else {
          // opcional: limpar pendentes expirados
          await env.DB.prepare(
              `UPDATE clientes
       SET email_pendente = NULL,
           token_verificacao = NULL,
           token_verificacao_expira = NULL,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
          ).bind(auth.clientId).run().catch(() => {})
        }
      }

      return ok({
        id:                     client.id,
        name:                   client.nome,
        email:                  client.email,
        phone:                  client.telefone,
        nif:                    client.nif,
        photo_url:              client.foto_perfil,
        completed_reservations: client.reservas_concluidas,
        next_appointment:       client.next_appointment_date,
        last_appointment:       client.last_appointment_date,
        created_at:             client.criado_em,
        auth_methods:           client.auth_methods,
        email_verified:         !!client.email_verificado,
        pending_email_change:   pendingEmail,
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

        // Guardar novo email e token diretamente em clientes
        await env.DB.prepare(
            `UPDATE clientes
             SET email_pendente = ?, 
                 token_verificacao = ?, 
                 token_verificacao_expira = ?,
                 atualizado_em = CURRENT_TIMESTAMP
             WHERE id = ?`
        ).bind(newEmail, token, expires, auth.clientId).run()

        const { html } = buildEmailChangeEmail({
          clientName:   current.nome,
          confirmToken: token,
          newEmail,
        })

        sendEmail(context, {
          to:      newEmail,
          subject: 'Confirme o novo email – Brooklyn Barbearia',
          html,
        }).catch(err =>
            console.error('[me] Erro ao enviar email de confirmação de alteração:', err)
        )

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
