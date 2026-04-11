import { ok, badRequest, notFound, serverError, corsOptions, unauthorized } from '../../utils/response.js'
import { authenticateClient } from '../../utils/auth.js'
import { sendEmail, buildVerificationEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'

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

    // Se o token já expirou ou não existe, gera um novo
    if (!verifyToken || !expMs || expMs <= now) {
      verifyToken = generateToken()
      const expires = new Date(now + 86400000).toISOString() // 24h

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
        subject: 'Verifique o seu email – Brooklyn Barbearia',
        html,
      })

      const emailId = resp?.id
      if (emailId) {
        await env.DB.prepare(
          `UPDATE clientes
             SET resend_verification_email_id = ?, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(emailId, client.id).run()
      }
    } catch (emailErr) {
      console.error('[send-verification] Falha ao enviar email de verificação:', {
        message:     emailErr?.message,
        key_present: !!context.env?.RESEND_API_KEY,
        to:          client.email,
      })
      // Não bloqueia a resposta – o token foi gravado e o cliente pode tentar de novo
    }

    return ok({ message: 'Email de verificação enviado' })
  } catch (e) {
    return serverError('Erro ao enviar email', e.message)
  }
}
