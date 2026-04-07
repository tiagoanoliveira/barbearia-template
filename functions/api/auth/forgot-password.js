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
        `UPDATE clientes
         SET token_reset_password = ?, token_reset_expira = ?, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = ?`
    ).bind(token, expires, client.id).run()

    const { html } = buildPasswordResetEmail({ clientName: client.nome, resetToken: token })

    // Aguarda envio de email e regista erro detalhado para diagnóstico no Cloudflare Logs
    try {
      await sendEmail(context, {
        to:      email,
        subject: 'Recuperação de Password – Brooklyn Barbearia',
        html,
      })
    } catch (emailErr) {
      console.error('[forgot-password] Falha ao enviar email:', JSON.stringify({
        message:     emailErr?.message,
        cause:       emailErr?.cause,
        key_present: !!env?.RESEND_API_KEY,
        to:          email,
      }))
      // Não bloqueia a resposta ao cliente
    }

    return ok({ message: 'Se o email existir, irá receber um link.' })
  } catch (e) {
    return serverError('Erro ao processar pedido', e.message)
  }
}
