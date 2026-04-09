/**
 * Serviço centralizado de emails de reserva.
 *
 * Expõe 4 funções públicas:
 *   sendReservationConfirmation  – envia email de confirmação e agenda lembrete 24h antes
 *   sendReservationCancellation  – envia email de cancelamento
 *   cancelScheduledReminder      – cancela um email agendado na Resend
 *   rescheduleReminder           – cancela o lembrete antigo e agenda um novo (usado em edições)
 *
 * Todos os erros são tratados internamente (não rebentam a request).
 * As funções que enviam emails usam context.waitUntil para não bloquear a resposta HTTP.
 */

import {
  sendEmail,
  buildReservationConfirmationEmail,
  buildReservationCancellationEmail,
} from './email.js'

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

// ─── helpers ─────────────────────────────────────────────────────────────────

/**
 * Devolve true se a data da reserva é mais de 24h no futuro
 * (só vale a pena agendar lembrete nesse caso).
 */
function isMoreThan24hAway(dataHora) {
  const diffMs = new Date(dataHora).getTime() - Date.now()
  return diffMs > 24 * 60 * 60 * 1000
}

/**
 * Formata a data do lembrete: 24h antes de dataHora, em ISO 8601.
 */
function reminderSendAt(dataHora) {
  const d = new Date(new Date(dataHora).getTime() - 24 * 60 * 60 * 1000)
  return d.toISOString()
}

// ─── 1. Agendar lembrete (privado) ───────────────────────────────────────────

/**
 * Agenda um email de lembrete via Resend scheduled emails.
 * Devolve o ID do email agendado, ou null em caso de erro.
 *
 * @param {object} context  – Cloudflare Pages context
 * @param {object} params
 * @param {number} params.reservaId
 * @param {string} params.clientEmail
 * @param {string} params.clientName
 * @param {string} params.dataHora    – ISO 8601, hora local Lisboa
 * @param {string} params.serviceName
 * @param {string} params.barberName
 * @param {number} params.duracao     – minutos
 * @returns {Promise<string|null>}
 */
async function _scheduleReminder(context, { reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao }) {
  const key = context.env?.RESEND_API_KEY
  if (!key) {
    console.warn('[_scheduleReminder] RESEND_API_KEY não definida — lembrete não agendado.')
    return null
  }

  if (!isMoreThan24hAway(dataHora)) {
    console.log(`[_scheduleReminder] Reserva #${reservaId} é em menos de 24h — lembrete não agendado.`)
    return null
  }

  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const html = buildReminderHtml({ clientName, data, hora, serviceName, barberName, reservaId })

  const payload = {
    from:        'Brooklyn Barbearia <noreply@brooklynbarbearia.pt>',
    to:          clientEmail,
    subject:     `Lembrete: reserva amanhã às ${hora} – Brooklyn Barbearia`,
    html,
    scheduled_at: reminderSendAt(dataHora),
  }

  try {
    const res  = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error(`[_scheduleReminder] Resend devolveu ${res.status}:`, JSON.stringify(body))
      return null
    }

    console.log(`[_scheduleReminder] Lembrete agendado para reserva #${reservaId}. ID Resend: ${body.id}`)
    return body.id ?? null
  } catch (err) {
    console.error('[_scheduleReminder] Erro de rede:', err?.message || err)
    return null
  }
}

// ─── 2. Cancelar lembrete agendado ───────────────────────────────────────────

/**
 * Cancela um email agendado na Resend dado o seu ID.
 * Não lança excepção — apenas regista erros.
 *
 * @param {object} context
 * @param {string} resendEmailId
 */
export async function cancelScheduledReminder(context, resendEmailId) {
  if (!resendEmailId) return

  const key = context.env?.RESEND_API_KEY
  if (!key) {
    console.warn('[cancelScheduledReminder] RESEND_API_KEY não definida.')
    return
  }

  try {
    const res = await fetch(`${RESEND_EMAILS_URL}/${resendEmailId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })

    if (res.ok) {
      console.log(`[cancelScheduledReminder] Email agendado ${resendEmailId} cancelado.`)
    } else {
      const txt = await res.text().catch(() => '')
      // 422 significa que o email já foi enviado ou já estava cancelado — não é um erro crítico
      if (res.status === 422) {
        console.warn(`[cancelScheduledReminder] Email ${resendEmailId} já enviado/cancelado (422) — ignorado.`)
      } else {
        console.error(`[cancelScheduledReminder] Resend devolveu ${res.status}:`, txt)
      }
    }
  } catch (err) {
    console.error('[cancelScheduledReminder] Erro de rede:', err?.message || err)
  }
}

// ─── 3. Enviar confirmação + agendar lembrete ────────────────────────────────

/**
 * Envia email de confirmação de reserva e, se a reserva for com > 24h de antecedência,
 * agenda um lembrete via Resend.
 *
 * Guarda o ID do lembrete agendado na coluna resend_lembrete_id da tabela reservas.
 * Usa context.waitUntil para não bloquear a resposta HTTP.
 *
 * @param {object} context
 * @param {object} params
 * @param {number} params.reservaId
 * @param {string} params.clientEmail
 * @param {string} params.clientName
 * @param {string} params.dataHora
 * @param {string} params.serviceName
 * @param {string} params.barberName
 * @param {number} params.duracao
 * @param {string} [params.comentario]
 */
export function sendReservationConfirmation(context, params) {
  const { reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao, comentario } = params

  if (!clientEmail) {
    console.warn(`[sendReservationConfirmation] Sem email para reserva #${reservaId} — nada enviado.`)
    return
  }

  context.waitUntil(
    (async () => {
      // 1. Email de confirmação
      try {
        const { html, attachments } = buildReservationConfirmationEmail({
          reservaId,
          clientName,
          clientEmail,
          dataHora,
          serviceName,
          barberName,
          duracao,
          comentario: comentario ?? '',
        })
        await sendEmail(context, {
          to:      clientEmail,
          subject: `Reserva #${reservaId} confirmada – Brooklyn Barbearia`,
          html,
          attachments,
        })
      } catch (err) {
        console.error(`[sendReservationConfirmation] Falha no email de confirmação para reserva #${reservaId}:`, err?.message || err)
      }

      // 2. Agendar lembrete 24h antes (se aplicável)
      try {
        const lembreteId = await _scheduleReminder(context, {
          reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao,
        })

        if (lembreteId) {
          await context.env.DB.prepare(
            'UPDATE reservas SET resend_lembrete_id = ? WHERE id = ?'
          ).bind(lembreteId, reservaId).run()
        }
      } catch (err) {
        console.error(`[sendReservationConfirmation] Falha ao agendar lembrete para reserva #${reservaId}:`, err?.message || err)
      }
    })()
  )
}

// ─── 4. Enviar cancelamento ───────────────────────────────────────────────────

/**
 * Envia email de cancelamento de reserva.
 * Cancela também o lembrete agendado, se existir.
 * Usa context.waitUntil para não bloquear a resposta HTTP.
 *
 * @param {object} context
 * @param {object} params
 * @param {number} params.reservaId
 * @param {string} params.clientEmail
 * @param {string} params.clientName
 * @param {string} params.dataHora
 * @param {string} params.serviceName
 * @param {string} params.barberName
 * @param {number} params.duracao
 * @param {string|null} [params.motivo]
 * @param {string|null} [params.resendLembreteId]  – ID do lembrete agendado a cancelar
 */
export function sendReservationCancellation(context, params) {
  const { reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao, motivo, resendLembreteId } = params

  if (!clientEmail) {
    console.warn(`[sendReservationCancellation] Sem email para reserva #${reservaId} — nada enviado.`)
    return
  }

  context.waitUntil(
    (async () => {
      // 1. Cancelar lembrete agendado (se existir)
      if (resendLembreteId) {
        await cancelScheduledReminder(context, resendLembreteId)
        // Limpar o ID na BD
        await context.env.DB.prepare(
          'UPDATE reservas SET resend_lembrete_id = NULL WHERE id = ?'
        ).bind(reservaId).run().catch(e => console.error('[sendReservationCancellation] Erro ao limpar resend_lembrete_id:', e?.message))
      }

      // 2. Email de cancelamento
      try {
        const { html, attachments } = buildReservationCancellationEmail({
          reservaId,
          clientName,
          clientEmail,
          dataHora,
          serviceName,
          barberName,
          duracao,
          motivo: motivo ?? null,
        })
        await sendEmail(context, {
          to:      clientEmail,
          subject: 'A tua reserva foi cancelada – Brooklyn Barbearia',
          html,
          attachments,
        })
      } catch (err) {
        console.error(`[sendReservationCancellation] Falha no email de cancelamento para reserva #${reservaId}:`, err?.message || err)
      }
    })()
  )
}

// ─── 5. Reagendar lembrete (usado em edições) ────────────────────────────────

/**
 * Cancela o lembrete existente (se houver) e agenda um novo com os dados actualizados.
 * Guarda o novo ID na BD.
 * Deve ser chamado com await (ou context.waitUntil) pelo caller.
 *
 * @param {object} context
 * @param {object} params
 * @param {number} params.reservaId
 * @param {string|null} params.oldLembreteId       – ID do lembrete a cancelar
 * @param {string} params.clientEmail
 * @param {string} params.clientName
 * @param {string} params.dataHora                 – nova data/hora
 * @param {string} params.serviceName
 * @param {string} params.barberName
 * @param {number} params.duracao
 */
export async function rescheduleReminder(context, params) {
  const { reservaId, oldLembreteId, clientEmail, clientName, dataHora, serviceName, barberName, duracao } = params

  // Cancelar o lembrete anterior
  if (oldLembreteId) {
    await cancelScheduledReminder(context, oldLembreteId)
  }

  // Agendar novo lembrete
  const newLembreteId = await _scheduleReminder(context, {
    reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao,
  })

  // Persistir novo ID (ou NULL se não agendado)
  await context.env.DB.prepare(
    'UPDATE reservas SET resend_lembrete_id = ? WHERE id = ?'
  ).bind(newLembreteId ?? null, reservaId).run().catch(e =>
    console.error('[rescheduleReminder] Erro ao actualizar resend_lembrete_id:', e?.message)
  )
}

// ─── Template HTML do lembrete ────────────────────────────────────────────────

function buildReminderHtml({ clientName, data, hora, serviceName, barberName, reservaId }) {
  const BASE_URL = 'https://brooklynbarbearia.pt'
  const YEAR = new Date().getFullYear()

  return `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;background:#f8f9fa}
  .wrap{background:linear-gradient(135deg,#f5f7fa,#e8ecf1);padding:40px 20px;min-height:100vh}
  .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.1)}
  .logo-sec{background:#2d4a3e;text-align:center;padding:30px 20px}
  .logo{max-width:70px;height:auto}
  .header{background:linear-gradient(135deg,#b45309,#d97706);color:#fff;padding:40px 30px;text-align:center}
  .header h1{margin:0;font-size:28px;font-weight:600;letter-spacing:-.5px}
  .content{padding:40px 30px}
  .content p{color:#4a5568;font-size:16px;margin-bottom:20px}
  .content strong{color:#2d3748;font-weight:600}
  .info-box{background:#fffbeb;border-radius:12px;padding:25px;margin:25px 0;border:1px solid #fde68a;border-left:4px solid #f59e0b}
  .info-box h3{color:#92400e;font-size:18px;margin-bottom:20px;font-weight:600}
  .detail-row{display:flex;align-items:flex-start;margin-bottom:15px;padding:12px;background:#fff;border-radius:8px}
  .detail-row:last-child{margin-bottom:0}
  .di{font-size:20px;margin-right:12px;min-width:24px}
  .dc{flex:1}
  .dc strong{display:block;color:#2d3748;margin-bottom:2px;font-size:14px}
  .cta-sec{text-align:center;margin:35px 0;padding:30px;background:linear-gradient(135deg,#fffbeb,#fef3c7);border-radius:12px}
  .btn{display:inline-block;background:linear-gradient(135deg,#2d4a3e,#3d5a4e);color:#fff!important;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:16px;box-shadow:0 4px 12px rgba(45,74,62,.3)}
  .footer{background:#1a202c;color:#a0aec0;text-align:center;padding:30px 20px}
  .footer p{margin:8px 0;font-size:14px}
  .footer a{color:#d4af7a;text-decoration:none}
  @media(max-width:600px){.content{padding:30px 20px}.info-box{padding:20px 15px}.detail-row{flex-direction:column}}
</style></head>
<body><div class="wrap"><div class="container">
  <div class="logo-sec">
    <img src="${BASE_URL}/images/logos/logo-512px.svg" alt="Brooklyn Barbearia" class="logo">
  </div>
  <div class="header"><h1>&#9200; Lembrete de Reserva</h1></div>
  <div class="content">
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Este é um lembrete de que tem uma reserva <strong>amanhã</strong>:</p>
    <div class="info-box">
      <h3>&#128197; Detalhes da Reserva #${reservaId}</h3>
      <div class="detail-row"><span class="di">&#128197;</span><div class="dc"><strong>Data:</strong>${data}</div></div>
      <div class="detail-row"><span class="di">&#128341;</span><div class="dc"><strong>Hora:</strong>${hora}</div></div>
      <div class="detail-row"><span class="di">&#9986;&#65039;</span><div class="dc"><strong>Serviço:</strong>${serviceName}</div></div>
      <div class="detail-row"><span class="di">&#128100;</span><div class="dc"><strong>Barbeiro:</strong>${barberName}</div></div>
    </div>
    <div class="cta-sec">
      <p style="color:#92400e;margin-bottom:20px">Precisa de cancelar ou reagendar?</p>
      <a href="${BASE_URL}/reservations" class="btn">Gerir a minha reserva</a>
    </div>
  </div>
  <div class="footer">
    <p style="font-size:12px;color:#718096">Este é um email automático, por favor não responda.</p>
    <p>&copy; ${YEAR} Brooklyn Barbearia &ndash; Todos os direitos reservados.
       Feito com &#129820; por <a href="https://www.tiagoanoliveira.pt">Tiago Oliveira</a>.</p>
  </div>
</div></div></body></html>`
}
