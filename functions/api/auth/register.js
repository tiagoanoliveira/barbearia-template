import { hashPassword, generateToken } from '../../utils/crypto.js'
import { created, ok, badRequest, conflict, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'
import { sendEmail, buildVerificationEmail } from '../../utils/email.js'
import { verifyTurnstile } from '../../utils/turnstile.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST') return badRequest('Método não permitido')

  try {
    const { name, email, phone, password, turnstileToken } = await request.json()

    if (!name || !email || !password) return badRequest('Nome, email e password são obrigatórios')
    if (password.length < 8)          return badRequest('Password mínimo 8 caracteres')

    // Proteção anti-abuso com Turnstile
    const turn = await verifyTurnstile(context, turnstileToken)
    if (!turn.success) {
      return badRequest('Falha na verificação de segurança. Atualize a página e tente novamente.')
    }

    const emailClean = sanitize(email, 200).toLowerCase()

    // Verificar se já existe cliente com este email
    const existing = await env.DB.prepare(
      `SELECT id, nome, email_verificado, token_verificacao, token_verificacao_expira, resend_verification_email_id
       FROM clientes WHERE email = ?`
    ).bind(emailClean).first()

    if (existing) {
      // Conta já verificada: não permitir novo registo
      if (existing.email_verificado) {
        return conflict('Email já registado')
      }

      // Conta ainda não verificada
      const now    = Date.now()
      const expRaw = existing.token_verificacao_expira
      const expMs  = expRaw ? Date.parse(expRaw) : 0

      let verifyToken = existing.token_verificacao

      // Token expirado ou inexistente → gerar novo token e atualizar
      if (!verifyToken || !expMs || expMs <= now) {
        verifyToken = generateToken()
        const expires = new Date(now + 86400000).toISOString() // 24h

        await env.DB.prepare(
          `UPDATE clientes
             SET token_verificacao = ?, token_verificacao_expira = ?, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(verifyToken, expires, existing.id).run()
      }

      // Reenviar email de verificação (sem criar nova conta)
      const { html } = buildVerificationEmail({ clientName: existing.nome, verifyToken })

      try {
        const resp = await sendEmail(context, {
          to:      emailClean,
          subject: 'Confirme o seu email – Brooklyn Barbearia',
          html,
        })

        const emailId = resp?.id
        if (emailId) {
          await env.DB.prepare(
            `UPDATE clientes
               SET resend_verification_email_id = ?, atualizado_em = CURRENT_TIMESTAMP
             WHERE id = ?`
          ).bind(emailId, existing.id).run()
        }
      } catch (err) {
        console.error('[register] Erro ao reenviar email de verificação:', err)
      }

      return ok({
        message: 'Já existe uma conta por confirmar com este email. Reenviámos o email de verificação.',
        email_pending_verification: true,
      })
    }

    // Verificar telemóvel duplicado
    if (phone && sanitize(phone, 30).trim()) {
      const phoneClean = sanitize(phone, 30).trim()
      const existingPhone = await env.DB.prepare(
        `SELECT id FROM clientes
         WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
      ).bind(phoneClean).first()

      if (existingPhone) {
        // Verificar se o cliente existente tem email placeholder (@withoutcontact.pt)
        // — isso significa que foi criado pelo admin sem email real.
        const existingClient = await env.DB.prepare(
          'SELECT email FROM clientes WHERE id = ?'
        ).bind(existingPhone.id).first()

        if (existingClient?.email?.toLowerCase().endsWith('@withoutcontact.pt')) {
          // Conta criada pelo admin sem email: orientar o utilizador para o suporte
          return conflict(JSON.stringify({
            code: 'PHONE_EXISTS_NO_EMAIL',
            message: 'Já existe uma conta associada a este número de telemóvel, mas sem email configurado.',
            hint: 'Para associar o seu email a esta conta, contacte o nosso suporte.',
            support_url: '/suporte',
          }))
        }

        // Telemóvel duplicado com email real: comportamento padrão
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

    const result = await env.DB.prepare(
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

    try {
      const resp = await sendEmail(context, {
        to:      emailClean,
        subject: 'Confirme o seu email – Brooklyn Barbearia',
        html,
      })

      const emailId = resp?.id
      if (emailId) {
        await env.DB.prepare(
          `UPDATE clientes
             SET resend_verification_email_id = ?, atualizado_em = CURRENT_TIMESTAMP
           WHERE id = ?`
        ).bind(emailId, result.meta.last_row_id).run()
      }
    } catch (err) {
      console.error('[register] Erro ao enviar email de verificação:', err)
    }

    return created({
      message: 'Conta criada! Verifique o seu email para ativar a conta.',
      email_pending_verification: true,
    })
  } catch (e) {
    return serverError('Erro ao registar', e.message)
  }
}
