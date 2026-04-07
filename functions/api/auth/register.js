import { hashPassword, generateToken } from '../../utils/crypto.js'
import { created, badRequest, conflict, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'
import { sendEmail, buildVerificationEmail } from '../../utils/email.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { name, email, phone, password } = await request.json()

    if (!name || !email || !password) return badRequest('Nome, email e password são obrigatórios')
    if (password.length < 8)          return badRequest('Password mínimo 8 caracteres')

    const emailClean = sanitize(email, 200).toLowerCase()

    // Verificar email duplicado
    const existingEmail = await env.DB.prepare(
        'SELECT id FROM clientes WHERE email = ?'
    ).bind(emailClean).first()
    if (existingEmail) return conflict('Email já registado')

    // Verificar telemóvel duplicado
    if (phone && sanitize(phone, 30).trim()) {
      const phoneClean = sanitize(phone, 30).trim()
      const existingPhone = await env.DB.prepare(
          `SELECT id FROM clientes
         WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
      ).bind(phoneClean).first()

      if (existingPhone) {
        return conflict(JSON.stringify({
          code: 'PHONE_EXISTS',
          message: 'Já existe uma conta com este número de telemóvel.',
          hint: 'Se pretende atualizar o email da sua conta existente, confirme abaixo.',
        }))
      }
    }

    const hash    = await hashPassword(password)
    const token   = generateToken()
    const expires = new Date(Date.now() + 86400000).toISOString() // 24h

    await env.DB.prepare(
        `INSERT INTO clientes
         (nome, email, telefone, password_hash, auth_methods,
          email_verificado, token_verificacao, token_verificacao_expira)
       VALUES (?, ?, ?, ?, 'password', 0, ?, ?)`
    ).bind(
        sanitize(name, 100),
        emailClean,
        sanitize(phone ?? '', 30),
        hash,
        token,
        expires,
    ).run()

    const { html } = buildVerificationEmail({ clientName: sanitize(name, 100), verifyToken: token })

    sendEmail(context, {
      to:      emailClean,
      subject: 'Confirme o seu email – Brooklyn Barbearia',
      html,
    }).catch(err => console.error('[register] Erro ao enviar email de verificação:', err))

    return created({
      message: 'Conta criada! Verifique o seu email para ativar a conta.',
      email_pending_verification: true,
    })
  } catch (e) {
    return serverError('Erro ao registar', e.message)
  }
}