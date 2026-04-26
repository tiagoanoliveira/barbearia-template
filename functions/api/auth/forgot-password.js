import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sendEmail, buildPasswordResetEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'
import { verifyTurnstile } from '../../utils/turnstile.js'
import { EMAIL_SUBJECTS } from '../../utils/site-config.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { email, turnstileToken } = await request.json()
    if (!email) return badRequest('Email obrigatório')

    const turn = await verifyTurnstile(context, turnstileToken)
    if (!turn.success) {
      return badRequest('Falha na verificação de segurança. Atualize a página e tente novamente.')
    }

    const client = await env.DB.prepare(
      'SELECT id, nome, token_reset_password, token_reset_expira, resend_reset_email_id FROM clientes WHERE email = ?'
    ).bind(email).first()

    if (!client) return ok({ message: 'Se o email existir, irá receber um link.' })

    const now   = Date.now()
    const expMs = client.token_reset_expira ? Date.parse(client.token_reset_expira) : 0

    if (client.token_reset_password && expMs && expMs > now) {
      return ok({ message: 'Se o email existir, irá receber um link.' })
    }

    const token   = generateToken()
    const expires = new Date(now + 3600000).toISOString() // 1h

    await env.DB.prepare(
        `UPDATE clientes
         SET token_reset_password = ?, token_reset_expira = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(token, expires, client.id).run()

    const { html } = buildPasswordResetEmail({ clientName: client.nome, resetToken: token })

    try {
      const resp = await sendEmail(context, {
        to:      email,
        subject: EMAIL_SUBJECTS.passwordReset,
        html,
      })

      const emailId = resp?.id
      if (emailId) {
        await env.DB.prepare(
          `UPDATE clientes SET resend_reset_email_id = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`
        ).bind(emailId, client.id).run()
      }
    } catch (emailErr) {
      console.error('[forgot-password] Falha ao enviar email:', {
        message:     emailErr?.message,
        key_present: !!env?.RESEND_API_KEY,
        to:          email,
      })
    }

    return ok({ message: 'Se o email existir, irá receber um link.' })
  } catch (e) {
    return serverError('Erro ao processar pedido', e.message)
  }
}
