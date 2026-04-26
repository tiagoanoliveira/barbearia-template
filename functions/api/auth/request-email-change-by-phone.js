/**
 * POST /api/auth/request-email-change-by-phone
 * Body: { phone, newEmail, turnstileToken }
 * Iniciado quando alguém tenta registar com um telefone já associado a outra conta.
 * Envia um email de confirmação para o email ATUAL da conta, com token de 24h.
 */
import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sendEmail, buildEmailChangeEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'
import { sanitize } from '../../utils/validators.js'
import { verifyTurnstile } from '../../utils/turnstile.js'
import { EMAIL_SUBJECTS } from '../../utils/site-config.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { phone, newEmail, turnstileToken } = await request.json()
    if (!phone || !newEmail) return badRequest('Telefone e novo email são obrigatórios')

    const turn = await verifyTurnstile(context, turnstileToken)
    if (!turn.success) {
      return badRequest('Falha na verificação de segurança. Atualize a página e tente novamente.')
    }

    const phoneClean    = sanitize(phone, 30).trim()
    const newEmailClean = sanitize(newEmail, 200).toLowerCase()

    const client = await env.DB.prepare(
      `SELECT id, nome, email, email_pendente, token_verificacao, token_verificacao_expira, resend_email_change_id
       FROM clientes
       WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
    ).bind(phoneClean).first()

    if (!client) return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })

    const emailTaken = await env.DB.prepare(
      'SELECT id FROM clientes WHERE email = ? AND id != ?'
    ).bind(newEmailClean, client.id).first()

    if (emailTaken) return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })

    const now   = Date.now()
    const expMs = client.token_verificacao_expira ? Date.parse(client.token_verificacao_expira) : 0

    if (client.email_pendente && client.token_verificacao && expMs && expMs > now) {
      return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })
    }

    const token   = generateToken()
    const expires = new Date(now + 86400000).toISOString()

    await env.DB.prepare(
      `UPDATE clientes
       SET email_pendente = ?, token_verificacao = ?, token_verificacao_expira = ?,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
    ).bind(newEmailClean, token, expires, client.id).run()

    const { html } = buildEmailChangeEmail({
      clientName:   client.nome,
      confirmToken: token,
      newEmail:     newEmailClean,
    })

    try {
      const resp = await sendEmail(context, {
        to:      client.email,
        subject: EMAIL_SUBJECTS.emailChange,
        html,
      })

      const emailId = resp?.id
      if (emailId) {
        await env.DB.prepare(
          `UPDATE clientes SET resend_email_change_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(emailId, client.id).run()
      }
    } catch (emailErr) {
      console.error('[request-email-change-by-phone] Erro ao enviar email:', emailErr)
    }

    return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })
  } catch (e) {
    return serverError('Erro ao processar pedido', e.message)
  }
}
