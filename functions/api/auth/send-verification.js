import { ok, badRequest, notFound, serverError, corsOptions, unauthorized } from '../../utils/response.js'
import { authenticateClient } from '../../utils/auth.js'
import { sendEmail, buildVerificationEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'
import { EMAIL_SUBJECTS } from '../../utils/site-config.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  try {
    const client = await env.DB.prepare(
      `SELECT id, nome, email, email_verificado,
              token_verificacao, token_verificacao_expira,
              resend_verification_email_id
       FROM clientes WHERE id = ?`
    ).bind(auth.clientId).first()

    if (!client)               return notFound('Cliente não encontrado')
    if (client.email_verificado) return ok({ message: 'Email já verificado' })
    if (!client.email)          return badRequest('Sem email associado')

    const now    = Date.now()
    const expRaw = client.token_verificacao_expira
    const expMs  = expRaw ? Date.parse(expRaw) : 0

    let verifyToken = client.token_verificacao

    if (!verifyToken || !expMs || expMs <= now) {
      verifyToken = generateToken()
      const expires = new Date(now + 86400000).toISOString()

      await env.DB.prepare(
        `UPDATE clientes
           SET token_verificacao = ?, token_verificacao_expira = ?,
               atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
      ).bind(verifyToken, expires, client.id).run()
    }

    const { html } = buildVerificationEmail({ clientName: client.nome, verifyToken })

    try {
      const resp = await sendEmail(context, {
        to:      client.email,
        subject: EMAIL_SUBJECTS.verifyEmail,
        html,
      })

      const emailId = resp?.id
      if (emailId) {
        await env.DB.prepare(
          `UPDATE clientes SET resend_verification_email_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(emailId, client.id).run()
      }
    } catch (emailErr) {
      console.error('[send-verification] Falha ao enviar email de verificação:', {
        message:     emailErr?.message,
        key_present: !!context.env?.RESEND_API_KEY,
        to:          client.email,
      })
    }

    return ok({ message: 'Email de verificação enviado' })
  } catch (e) {
    return serverError('Erro ao enviar email', e.message)
  }
}
