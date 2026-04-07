import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sendEmail, buildPasswordResetEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { email } = await request.json()
    if (!email) return badRequest('Email obrigatório')

    const client = await env.DB.prepare(
      'SELECT id, nome FROM clientes WHERE email = ?'
    ).bind(email).first()

    // Responde sempre com sucesso para não revelar se o email existe
    if (!client) return ok({ message: 'Se o email existir, irá receber um link.' })

    const token   = generateToken()
    const expires = new Date(Date.now() + 3600000).toISOString() // 1h

    await env.DB.prepare(
      `INSERT OR REPLACE INTO token_reset_password (cliente_id, token, expires_at)
       VALUES (?, ?, ?)`
    ).bind(client.id, token, expires).run()

    const { html } = buildPasswordResetEmail({ clientName: client.nome, resetToken: token })

    // Dispara email mas não bloqueia se falhar
    sendEmail(context, {
      to:      email,
      subject: 'Recuperação de Password – Brooklyn Barbearia',
      html,
    }).catch(() => {})

    return ok({ message: 'Se o email existir, irá receber um link.' })
  } catch (e) {
    return serverError('Erro ao processar pedido', e.message)
  }
}
