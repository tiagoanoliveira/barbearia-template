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
      'SELECT id, nome, email, email_verificado FROM clientes WHERE id = ?'
    ).bind(auth.clientId).first()

    if (!client)               return notFound('Cliente não encontrado')
    if (client.email_verificado) return ok({ message: 'Email já verificado' })
    if (!client.email)          return badRequest('Sem email associado')

    const token   = generateToken()
    const expires = new Date(Date.now() + 86400000).toISOString() // 24h

    await env.DB.prepare(
      `INSERT OR REPLACE INTO email_verification_tokens (cliente_id, token, expires_at)
       VALUES (?, ?, ?)`
    ).bind(client.id, token, expires).run()

    const { html } = buildVerificationEmail({ clientName: client.nome, verifyToken: token })

    await sendEmail(context, {
      to:      client.email,
      subject: 'Verifique o seu email – Brooklyn Barbearia',
      html,
    })

    return ok({ message: 'Email de verificação enviado' })
  } catch (e) {
    return serverError('Erro ao enviar email', e.message)
  }
}
