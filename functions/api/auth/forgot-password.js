import { createResponse, createErrorResponse } from '../../utils/auth.js'
import { getDB } from '../../utils/db.js'
import { sendEmail, buildPasswordResetEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'

export async function onRequestPost(context) {
  const { email } = await context.request.json()
  if (!email) return createErrorResponse('Email obrigatório', 400)

  const db = getDB(context)
  const client = await db.prepare('SELECT id, nome FROM clientes WHERE email = ?').bind(email).first()

  // Responde sempre com sucesso para não revelar se o email existe
  if (!client) return createResponse({ ok: true })

  const token   = await generateToken()
  const expires = new Date(Date.now() + 3600000).toISOString() // 1h

  await db.prepare(
    'INSERT OR REPLACE INTO password_reset_tokens (cliente_id, token, expires_at) VALUES (?,?,?)'
  ).bind(client.id, token, expires).run()

  const { html } = buildPasswordResetEmail({ clientName: client.nome, resetToken: token })

  await sendEmail(context, {
    to:      email,
    subject: 'Recuperação de Password – Brooklyn Barbearia',
    html,
  }).catch(() => {}) // não bloqueia em caso de falha de email

  return createResponse({ ok: true })
}
