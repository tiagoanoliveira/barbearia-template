import { createResponse, createErrorResponse, authenticateClient } from '../../utils/auth.js'
import { getDB } from '../../utils/db.js'
import { sendEmail, buildVerificationEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'

export async function onRequestPost(context) {
  const auth = await authenticateClient(context)
  if (!auth.success) return createErrorResponse(auth.error, 401)

  const db = getDB(context)
  const client = await db.prepare('SELECT id, nome, email, email_verificado FROM clientes WHERE id = ?')
    .bind(auth.clientId).first()

  if (!client) return createErrorResponse('Cliente não encontrado', 404)
  if (client.email_verificado) return createResponse({ ok: true, message: 'Email já verificado' })
  if (!client.email) return createErrorResponse('Sem email associado', 400)

  const token   = await generateToken()
  const expires = new Date(Date.now() + 86400000).toISOString() // 24h

  await db.prepare(
    'INSERT OR REPLACE INTO email_verification_tokens (cliente_id, token, expires_at) VALUES (?,?,?)'
  ).bind(client.id, token, expires).run()

  const { html } = buildVerificationEmail({ clientName: client.nome, verifyToken: token })

  await sendEmail(context, {
    to:      client.email,
    subject: 'Verifique o seu email – Brooklyn Barbearia',
    html,
  })

  return createResponse({ ok: true, message: 'Email de verificação enviado' })
}
