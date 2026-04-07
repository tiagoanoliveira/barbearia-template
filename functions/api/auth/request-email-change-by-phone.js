/**
 * POST /api/auth/request-email-change-by-phone
 * Body: { phone, newEmail }
 * Iniciado quando alguém tenta registar com um telefone já associado a outra conta.
 * Envia um email de confirmação para o email ATUAL da conta, com token de 24h.
 */
import { ok, badRequest, serverError, corsOptions } from '../../utils/response.js'
import { sendEmail, buildEmailChangeEmail } from '../../utils/email.js'
import { generateToken } from '../../utils/crypto.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
    const { request, env } = context
    if (request.method === 'OPTIONS') return corsOptions()
    if (request.method !== 'POST') return badRequest('Método não permitido')

    try {
        const { phone, newEmail } = await request.json()
        if (!phone || !newEmail) return badRequest('Telefone e novo email são obrigatórios')

        const phoneClean    = sanitize(phone, 30).trim()
        const newEmailClean = sanitize(newEmail, 200).toLowerCase()

        // Encontrar conta existente pelo telefone
        const client = await env.DB.prepare(
            `SELECT id, nome, email
       FROM clientes
       WHERE replace(replace(telefone,' ',''),'-','') = replace(replace(?,' ',''),'-','')`
        ).bind(phoneClean).first()

        // Responder sempre com sucesso para não revelar se o número existe
        if (!client) return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })

        // Verificar se o novo email já está em uso noutra conta
        const emailTaken = await env.DB.prepare(
            'SELECT id FROM clientes WHERE email = ? AND id != ?'
        ).bind(newEmailClean, client.id).first()

        if (emailTaken) return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })

        const token   = generateToken()
        const expires = new Date(Date.now() + 86400000).toISOString() // 24h

        await env.DB.prepare(
            `UPDATE clientes
       SET email_pendente = ?, token_verificacao = ?, token_verificacao_expira = ?,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = ?`
        ).bind(newEmailClean, token, expires, client.id).run()

        const { html } = buildEmailChangeEmail({
            clientName:   client.nome,
            confirmToken: token,
            newEmail:     newEmailClean,
        })

        try {
            await sendEmail(context, {
                to:      client.email, // envia para o email ATUAL, não para o novo
                subject: 'Confirme a alteração de email – Brooklyn Barbearia',
                html,
            })
        } catch (emailErr) {
            console.error('[request-email-change-by-phone] Erro ao enviar email:', emailErr)
        }

        return ok({ message: 'Se o número existir, será enviado um email de confirmação.' })
    } catch (e) {
        return serverError('Erro ao processar pedido', e.message)
    }
}