/**
 * Serviço centralizado de emails de reserva.
 *
 * Expõe 5 funções públicas:
 *   sendReservationConfirmation  – envia email de confirmação e agenda lembrete 24h antes
 *   sendReservationCancellation  – envia email de cancelamento e cancela lembrete agendado
 *   sendReviewRequest            – envia email a pedir avaliação no Google (só se SHOP.googleReviewUrl != null)
 *   cancelScheduledReminder      – cancela um email agendado na Resend
 *   rescheduleReminder           – cancela o lembrete antigo e agenda um novo (usado em edições);
 *                                  opcionalmente envia também email de confirmação actualizada
 *
 * Todos os erros são tratados internamente (não rebentam a request).
 * As funções que enviam emails usam context.waitUntil para não bloquear a resposta HTTP.
 */

import {
  sendEmail,
  buildReservationConfirmationEmail,
  buildReservationCancellationEmail,
  buildReminderEmail,
  buildReviewRequestEmail,
  isPlaceholderEmail,
} from './email.js'
import { SHOP, EMAIL_SUBJECTS } from './site-config.js'

const RESEND_EMAILS_URL = 'https://api.resend.com/emails'

// ── helpers ────────────────────────────────────────────────────────────────────────────────────

function isMoreThan24hAway(dataHora) {
  const diffMs = new Date(dataHora).getTime() - Date.now()
  return diffMs > 24 * 60 * 60 * 1000
}

function reminderSendAt(dataHora) {
  const d = new Date(new Date(dataHora).getTime() - 24 * 60 * 60 * 1000)
  return d.toISOString()
}

// ── 1. Agendar lembrete (privado) ───────────────────────────────────────────────────────────

async function _scheduleReminder(context, { reservaId, clientEmail, clientName, dataHora, serviceName, barberName }) {
  // ✓ Bloquear imediatamente emails placeholder — nunca chegar à Resend
  if (isPlaceholderEmail(clientEmail)) {
    console.log(`[_scheduleReminder] Reserva #${reservaId}: email placeholder "${clientEmail}" — lembrete não agendado.`)
    return null
  }

  const key = context.env?.RESEND_API_KEY
  if (!key) {
    console.warn('[_scheduleReminder] RESEND_API_KEY não definida — lembrete não agendado.')
    return null
  }

  if (!isMoreThan24hAway(dataHora)) {
    console.log(`[_scheduleReminder] Reserva #${reservaId}: dataHora=${dataHora} é em menos de 24h — lembrete não agendado.`)
    return null
  }

  const sendAt = reminderSendAt(dataHora)
  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', {day: '2-digit', month: '2-digit', year: 'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', {hour: '2-digit', minute: '2-digit' })

  const { html } = buildReminderEmail({ clientName, data, hora, serviceName, barberName, reservaId })

  const payload = {
    from:         SHOP.fromEmail,
    to:           clientEmail,
    subject:      `Lembrete: reserva amanhã às ${hora} – ${SHOP.name}`,
    html,
    scheduled_at: sendAt,
  }

  console.log(`[_scheduleReminder] Reserva #${reservaId}: a agendar lembrete para ${clientEmail}, scheduled_at=${sendAt}`)

  try {
    const res  = await fetch(RESEND_EMAILS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      console.error(`[_scheduleReminder] Reserva #${reservaId}: Resend devolveu ${res.status}:`, JSON.stringify(body))
      return null
    }

    console.log(`[_scheduleReminder] Reserva #${reservaId}: lembrete agendado com sucesso. ID Resend: ${body.id}`)
    return body.id ?? null
  } catch (err) {
    console.error('[_scheduleReminder] Erro de rede:', err?.message || err)
    return null
  }
}

// ── 2. Cancelar lembrete agendado ────────────────────────────────────────────────────────────────────────────────

export async function cancelScheduledReminder(context, resendEmailId) {
  console.log(`[cancelScheduledReminder] Chamada com resendEmailId=${JSON.stringify(resendEmailId)}`)

  if (!resendEmailId) {
    console.warn('[cancelScheduledReminder] resendEmailId está vazio/null/undefined — nada a cancelar.')
    return
  }

  const key = context.env?.RESEND_API_KEY
  if (!key) {
    console.warn('[cancelScheduledReminder] RESEND_API_KEY não definida — cancelamento impossível.')
    return
  }

  const url = `${RESEND_EMAILS_URL}/${resendEmailId}/cancel`
  console.log(`[cancelScheduledReminder] A chamar POST ${url}`)

  try {
    const res     = await fetch(url, {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    })
    const rawText = await res.text().catch(() => '')

    console.log(`[cancelScheduledReminder] Resend respondeu com status=${res.status}, body=${rawText}`)

    if (res.ok) {
      console.log(`[cancelScheduledReminder] Email agendado ${resendEmailId} cancelado com sucesso.`)
    } else if (res.status === 422) {
      console.warn(`[cancelScheduledReminder] Email ${resendEmailId} já enviado/cancelado (422) — ignorado. Body: ${rawText}`)
    } else if (res.status === 404) {
      console.warn(`[cancelScheduledReminder] Email ${resendEmailId} não encontrado na Resend (404) — pode ter sido enviado ou o ID está errado. Body: ${rawText}`)
    } else {
      console.error(`[cancelScheduledReminder] Erro inesperado ao cancelar ${resendEmailId}: status=${res.status}, body=${rawText}`)
    }
  } catch (err) {
    console.error(`[cancelScheduledReminder] Excepção de rede ao cancelar ${resendEmailId}:`, err?.message || err)
  }
}

// ── 3. Enviar confirmação + agendar lembrete ──────────────────────────────────────────────────────────────

export function sendReservationConfirmation(context, params) {
  const { reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao, comentario } = params

  if (!clientEmail) {
    console.warn(`[sendReservationConfirmation] Sem email para reserva #${reservaId} — nada enviado.`)
    return
  }

  // Bloquear placeholder (proteção em profundidade — o admin já verifica antes de chamar)
  if (isPlaceholderEmail(clientEmail)) {
    console.warn(`[sendReservationConfirmation] Reserva #${reservaId}: email placeholder "${clientEmail}" — confirmação e lembrete não enviados.`)
    return
  }

  console.log(`[sendReservationConfirmation] Reserva #${reservaId}: a iniciar envio de confirmação para ${clientEmail}`)

  context.waitUntil(
    (async () => {
      // 1. Email de confirmação (sequence=0 na criação inicial)
      try {
        const { html, attachments } = buildReservationConfirmationEmail({
          reservaId, clientName, clientEmail, dataHora, serviceName, barberName, duracao,
          comentario: comentario ?? '',
          sequence: 0,
        })
        await sendEmail(context, {
          to:      clientEmail,
          subject: `Reserva #${reservaId} confirmada – ${SHOP.name}`,
          html,
          attachments,
        })
        console.log(`[sendReservationConfirmation] Reserva #${reservaId}: email de confirmação enviado.`)
      } catch (err) {
        console.error(`[sendReservationConfirmation] Reserva #${reservaId}: falha no email de confirmação:`, err?.message || err)
      }

      // 2. Agendar lembrete 24h antes (se aplicável)
      // isPlaceholderEmail já é verificado dentro de _scheduleReminder
      try {
        const lembreteId = await _scheduleReminder(context, {
          reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao,
        })

        if (lembreteId) {
          await context.env.DB.prepare(
            'UPDATE reservas SET resend_lembrete_id = ? WHERE id = ?'
          ).bind(lembreteId, reservaId).run()
          console.log(`[sendReservationConfirmation] Reserva #${reservaId}: resend_lembrete_id=${lembreteId} guardado na BD.`)
        } else {
          console.log(`[sendReservationConfirmation] Reserva #${reservaId}: sem lembrete agendado (menos de 24h, placeholder ou erro).`)
        }
      } catch (err) {
        console.error(`[sendReservationConfirmation] Reserva #${reservaId}: falha ao agendar lembrete:`, err?.message || err)
      }
    })()
  )
}

// ── 4. Enviar cancelamento + cancelar lembrete ──────────────────────────────────────────────────────────────

export function sendReservationCancellation(context, params) {
  const { reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao, motivo, resendLembreteId } = params

  if (!clientEmail) {
    console.warn(`[sendReservationCancellation] Sem email para reserva #${reservaId} — nada enviado.`)
    return
  }

  // Email placeholder não recebe emails (não há confirmação, não há cancelamento)
  if (isPlaceholderEmail(clientEmail)) {
    console.log(`[sendReservationCancellation] Reserva #${reservaId}: email placeholder — email de cancelamento não enviado.`)
    return
  }

  console.log(
    `[sendReservationCancellation] Reserva #${reservaId}: clientEmail=${clientEmail},`,
    `resendLembreteId recebido=${JSON.stringify(resendLembreteId)}`
  )

  context.waitUntil(
    (async () => {
      // 1. Cancelar lembrete agendado (se existir)
      if (resendLembreteId) {
        console.log(`[sendReservationCancellation] Reserva #${reservaId}: a cancelar lembrete ${resendLembreteId}…`)
        await cancelScheduledReminder(context, resendLembreteId)
        await context.env.DB.prepare(
          'UPDATE reservas SET resend_lembrete_id = NULL WHERE id = ?'
        ).bind(reservaId).run().catch(e =>
          console.error('[sendReservationCancellation] Erro ao limpar resend_lembrete_id:', e?.message)
        )
        console.log(`[sendReservationCancellation] Reserva #${reservaId}: resend_lembrete_id limpo na BD.`)
      } else {
        console.log(`[sendReservationCancellation] Reserva #${reservaId}: sem lembrete agendado para cancelar.`)
      }

      // 2. Email de cancelamento
      try {
        const { html, attachments } = buildReservationCancellationEmail({
          reservaId, clientName, clientEmail, dataHora, serviceName, barberName, duracao,
          motivo: motivo ?? null,
        })
        await sendEmail(context, {
          to:      clientEmail,
          subject: EMAIL_SUBJECTS.cancellation,
          html,
          attachments,
        })
        console.log(`[sendReservationCancellation] Reserva #${reservaId}: email de cancelamento enviado para ${clientEmail}.`)
      } catch (err) {
        console.error(`[sendReservationCancellation] Reserva #${reservaId}: falha no email de cancelamento:`, err?.message || err)
      }
    })()
  )
}

// ── 5. Enviar pedido de avaliação Google ─────────────────────────────────────────────────────
/**
 * Chamada quando uma reserva é marcada como 'concluida'.
 * Não envia nada se:
 *   – SHOP.googleReviewUrl for null/falsy
 *   – o cliente não tiver email
 *   – o email for um placeholder
 *
 * @param {object} context  - Contexto do Cloudflare Worker
 * @param {object} params
 * @param {number} params.reservaId
 * @param {string} params.clientEmail
 * @param {string} params.clientName
 * @param {string} params.serviceName
 */
export function sendReviewRequest(context, { reservaId, clientEmail, clientName, serviceName }) {
  // Guard: link não configurado → não enviar
  if (!SHOP.googleReviewUrl) {
    console.log(`[sendReviewRequest] Reserva #${reservaId}: SHOP.googleReviewUrl não configurado — email não enviado.`)
    return
  }

  if (!clientEmail) {
    console.warn(`[sendReviewRequest] Reserva #${reservaId}: sem email — pedido de avaliação não enviado.`)
    return
  }

  if (isPlaceholderEmail(clientEmail)) {
    console.log(`[sendReviewRequest] Reserva #${reservaId}: email placeholder — pedido de avaliação não enviado.`)
    return
  }

  console.log(`[sendReviewRequest] Reserva #${reservaId}: a enviar pedido de avaliação para ${clientEmail}`)

  context.waitUntil(
    (async () => {
      try {
        const { html } = buildReviewRequestEmail({
          clientName,
          serviceName,
          reviewUrl: SHOP.googleReviewUrl,
        })
        await sendEmail(context, {
          to:      clientEmail,
          subject: EMAIL_SUBJECTS.reviewRequest,
          html,
        })
        console.log(`[sendReviewRequest] Reserva #${reservaId}: email de avaliação enviado para ${clientEmail}.`)
      } catch (err) {
        console.error(`[sendReviewRequest] Reserva #${reservaId}: falha no envio:`, err?.message || err)
      }
    })()
  )
}

// ── 6. Reagendar lembrete (usado em edições) ──────────────────────────────────────────────────────────────
/**
 * Cancela o lembrete anterior e agenda um novo.
 * Se sendConfirmation=true, envia também um email de confirmação actualizada
 * com um ICS de METHOD:REQUEST e SEQUENCE=sequence para sobrescrever o evento
 * no calendário do cliente sem criar um duplicado.
 *
 * @param {object} params
 * @param {number}  params.reservaId
 * @param {string|null} params.oldLembreteId
 * @param {string}  params.clientEmail
 * @param {string}  params.clientName
 * @param {string}  params.dataHora
 * @param {string}  params.serviceName
 * @param {string}  params.barberName
 * @param {number}  [params.duracao]
 * @param {boolean} [params.sendConfirmation=false]  – se true, envia email de confirmação actualizada
 * @param {number}  [params.sequence=1]              – SEQUENCE do ICS (nº de edições já feitas)
 */
export async function rescheduleReminder(context, params) {
  const {
    reservaId, oldLembreteId, clientEmail, clientName,
    dataHora, serviceName, barberName, duracao,
    sendConfirmation = false,
    sequence = 1,
  } = params

  console.log(
    `[rescheduleReminder] Reserva #${reservaId}: oldLembreteId=${JSON.stringify(oldLembreteId)},`,
    `clientEmail=${clientEmail}, nova dataHora=${dataHora},`,
    `sendConfirmation=${sendConfirmation}, sequence=${sequence}`
  )

  // Email placeholder — não agendar nem cancelar (não havia lembrete válido)
  if (isPlaceholderEmail(clientEmail)) {
    console.log(`[rescheduleReminder] Reserva #${reservaId}: email placeholder — sem lembrete para reagendar.`)
    await context.env.DB.prepare(
      'UPDATE reservas SET resend_lembrete_id = NULL WHERE id = ?'
    ).bind(reservaId).run().catch(e =>
      console.error('[rescheduleReminder] Erro ao limpar resend_lembrete_id:', e?.message)
    )
    return
  }

  // 1. Cancelar o lembrete anterior
  if (oldLembreteId) {
    console.log(`[rescheduleReminder] Reserva #${reservaId}: a cancelar lembrete antigo ${oldLembreteId}…`)
    await cancelScheduledReminder(context, oldLembreteId)
  } else {
    console.log(`[rescheduleReminder] Reserva #${reservaId}: sem lembrete anterior para cancelar.`)
  }

  // 2. Agendar novo lembrete (_scheduleReminder também verifica isPlaceholderEmail)
  const newLembreteId = await _scheduleReminder(context, {
    reservaId, clientEmail, clientName, dataHora, serviceName, barberName, duracao,
  })

  // 3. Persistir novo ID (ou NULL se não agendado)
  await context.env.DB.prepare(
    'UPDATE reservas SET resend_lembrete_id = ? WHERE id = ?'
  ).bind(newLembreteId ?? null, reservaId).run().catch(e =>
    console.error('[rescheduleReminder] Erro ao actualizar resend_lembrete_id:', e?.message)
  )

  console.log(
    `[rescheduleReminder] Reserva #${reservaId}: resend_lembrete_id actualizado para`,
    newLembreteId ?? 'NULL (menos de 24h ou erro)'
  )

  // 4. Enviar email de confirmação actualizada (com ICS de actualização)
  if (sendConfirmation) {
    try {
      const { html, attachments } = buildReservationConfirmationEmail({
        reservaId, clientName, clientEmail, dataHora, serviceName, barberName, duracao,
        sequence,
      })
      await sendEmail(context, {
        to:      clientEmail,
        subject: `Reserva #${reservaId} actualizada – ${SHOP.name}`,
        html,
        attachments,
      })
      console.log(`[rescheduleReminder] Reserva #${reservaId}: email de confirmação actualizada enviado (sequence=${sequence}).`)
    } catch (err) {
      console.error(`[rescheduleReminder] Reserva #${reservaId}: falha no email de confirmação actualizada:`, err?.message || err)
    }
  }
}
