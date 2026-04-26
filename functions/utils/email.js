/**
 * Utilitário de envio de email via Resend.
 * Usado por todos os endpoints que precisam de enviar emails.
 *
 * Todos os dados da barbearia (nome, domínio, contacto) são importados
 * de functions/utils/site-config.js — edite apenas aí.
 */

import { SHOP, LOGO_URL, LOGO_ALT, CURRENT_YEAR } from './site-config.js'

/**
 * Verifica se um endereço de email é um placeholder sem contacto.
 */
export function isPlaceholderEmail(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith('@withoutcontact.pt')
}

/**
 * Converte uma string UTF-8 para Base64 de forma segura.
 */
function toBase64(str) {
  const bytes = new TextEncoder().encode(str)
  let binary = ''
  bytes.forEach(b => { binary += String.fromCharCode(b) })
  return btoa(binary)
}

// ─── CSS partilhado ───────────────────────────────────────────────────────────────────
function emailCSS() {
  return `
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
         line-height:1.6;background:#f8f9fa}
    .wrap{background:linear-gradient(135deg,#f5f7fa,#e8ecf1);padding:40px 20px;min-height:100vh}
    .container{max-width:600px;margin:0 auto;background:#fff;border-radius:16px;
               overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.1)}
    .logo-sec{background:#2d4a3e;text-align:center;padding:30px 20px}
    .logo{max-width:70px;height:auto}
    .header-green{background:linear-gradient(135deg,#16a34a,#22c55e);color:#fff;
                  padding:40px 30px;text-align:center}
    .header-red{background:linear-gradient(135deg,#c0392b,#e74c3c);color:#fff;
                padding:40px 30px;text-align:center}
    .header-gold{background:linear-gradient(135deg,#92400e,#d4a017);color:#fff;
                 padding:40px 30px;text-align:center}
    .header-green h1,.header-red h1,.header-gold h1{margin:0;font-size:28px;
      font-weight:600;letter-spacing:-.5px}
    .content{padding:40px 30px}
    .content p{color:#4a5568;font-size:16px;margin-bottom:20px}
    .content strong{color:#2d3748;font-weight:600}
    .info-box{background:#f7fafc;border-radius:12px;padding:25px;margin:25px 0;
              border:1px solid #e2e8f0}
    .info-box h3{color:#2d3748;font-size:18px;margin-bottom:20px;font-weight:600}
    .border-green{border-left:4px solid #22c55e}
    .border-red{border-left:4px solid #e74c3c}
    .border-amber{border-left:4px solid #f59e0b;background:#fffbf5}
    .detail-row{display:flex;align-items:flex-start;margin-bottom:15px;
                padding:12px;background:#fff;border-radius:8px}
    .detail-row:last-child{margin-bottom:0}
    .di{font-size:20px;margin-right:12px;min-width:24px}
    .dc{flex:1}
    .dc strong{display:block;color:#2d3748;margin-bottom:2px;font-size:14px}
    .reason-text{color:#78350f;font-style:italic;margin:0;padding:10px 15px;
                 background:#fef3c7;border-radius:8px}
    .cta-sec{text-align:center;margin:35px 0;padding:30px;
             background:linear-gradient(135deg,#f0fdf4,#dcfce7);border-radius:12px}
    .cta-text{color:#166534;font-size:16px;margin-bottom:20px}
    .btn{display:inline-block;background:linear-gradient(135deg,#2d4a3e,#3d5a4e);
         color:#fff!important;text-decoration:none;padding:14px 32px;
         border-radius:8px;font-weight:600;font-size:16px;
         box-shadow:0 4px 12px rgba(45,74,62,.3)}
    .contact-sec{margin-top:30px;text-align:center}
    .contact-link{display:inline-flex;align-items:center;color:#2d4a3e;
                  text-decoration:none;font-weight:600;font-size:18px;
                  padding:12px 24px;background:#f0fdf4;border-radius:8px}
    .warn{background:#fff3cd;border-left:4px solid #ffc107;padding:12px;margin:20px 0}
    .footer{background:#1a202c;color:#a0aec0;text-align:center;padding:30px 20px}
    .footer p{margin:8px 0;font-size:14px}
    .footer a{color:#d4af7a;text-decoration:none}
    @media(max-width:600px){
      .content{padding:30px 20px}
      .info-box{padding:20px 15px}
      .detail-row{flex-direction:column}
    }
  `
}

function shell(headerClass, headerTitle, body) {
  return `<!DOCTYPE html><html lang="pt"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>${emailCSS()}</style></head>
<body><div class="wrap"><div class="container">
  <div class="logo-sec">
    <img src="${LOGO_URL}" alt="${LOGO_ALT}" class="logo">
  </div>
  <div class="${headerClass}"><h1>${headerTitle}</h1></div>
  <div class="content">${body}</div>
  <div class="footer">
    <p style="font-size:12px;color:#718096">Este é um email automático, por favor não responda.</p>
    <p>&copy; ${CURRENT_YEAR} ${SHOP.name} &ndash; Todos os direitos reservados.
       Feito com &#129820; por <a href="https://www.tiagoanoliveira.pt">Tiago Oliveira</a>.</p>
  </div>
</div></div></body></html>`
}

function detailRow(icon, label, value) {
  return `<div class="detail-row"><span class="di">${icon}</span>
<div class="dc"><strong>${label}</strong>${value}</div></div>`
}

function icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${SHOP.name}//Reservas//PT`,
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    'BEGIN:VEVENT',
    `UID:reserva-${reservaId}@${new URL(SHOP.baseUrl).hostname}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
    `SUMMARY:Reserva - ${serviceName} com ${barberName}`,
    `DESCRIPTION:Confirmacao de reserva na ${SHOP.name}`,
    `LOCATION:${SHOP.name} \u2013 ${SHOP.address}`,
    `ORGANIZER;CN=${SHOP.name}:mailto:${SHOP.email}`,
    `ATTENDEE:mailto:${clientEmail}`,
    'STATUS:CONFIRMED', 'SEQUENCE:0',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

function icsCancelled(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${SHOP.name}//Reservas//PT`,
    'CALSCALE:GREGORIAN', 'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `UID:reserva-${reservaId}@${new URL(SHOP.baseUrl).hostname}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART:${dtStart}`, `DTEND:${dtEnd}`,
    `SUMMARY:CANCELADA - ${serviceName} com ${barberName}`,
    `DESCRIPTION:Esta reserva foi cancelada pela ${SHOP.name}`,
    `LOCATION:${SHOP.name} \u2013 ${SHOP.address}`,
    `ORGANIZER;CN=${SHOP.name}:mailto:${SHOP.email}`,
    `ATTENDEE:mailto:${clientEmail}`,
    'STATUS:CANCELLED', 'SEQUENCE:1',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

function icsParams(dataHora, duracao) {
  const dt  = new Date(dataHora)
  const pad = n => String(n).padStart(2, '0')
  const fmt = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00Z`
  return { dtStart: fmt(dt), dtEnd: fmt(new Date(dt.getTime() + (duracao || 60) * 60000)) }
}

// ─── Envio central ─────────────────────────────────────────────────────────────────────
export async function sendEmail(context, { to, subject, html, attachments = [] }) {
  if (isPlaceholderEmail(to)) {
    console.warn(`[sendEmail] Envio bloqueado para "${to}" — cliente sem email atualizado.`)
    throw new Error('EMAIL_NOT_UPDATED: Este cliente não tem um email válido configurado. Por favor atualize o email no painel de administração.')
  }

  const key = context.env?.RESEND_API_KEY
  if (!key) {
    console.error('[sendEmail] RESEND_API_KEY não está definida nas variáveis de ambiente.')
    throw new Error('RESEND_API_KEY não configurada')
  }

  const payload = { from: SHOP.fromEmail, to, subject, html }
  if (attachments.length) payload.attachments = attachments

  console.log(`[sendEmail] A enviar para: ${to} | assunto: "${subject}" | anexos: ${attachments.length}`)

  let res
  try {
    res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    })
  } catch (fetchErr) {
    console.error('[sendEmail] Erro de rede ao chamar Resend API:', fetchErr)
    throw fetchErr
  }

  const responseText = await res.text()
  if (!res.ok) {
    console.error(`[sendEmail] Resend devolveu ${res.status}:`, responseText)
    throw new Error(`Resend error ${res.status}: ${responseText}`)
  }

  console.log(`[sendEmail] Enviado com sucesso para ${to}.`)
  try { return JSON.parse(responseText) } catch { return { raw: responseText } }
}

export async function retrieveEmail(context, emailId) {
  const key = context.env?.RESEND_API_KEY
  if (!key || !emailId) return null
  try {
    const res  = await fetch(`https://api.resend.com/emails/${emailId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    const text = await res.text()
    if (!res.ok) { console.error(`[retrieveEmail] ${res.status}:`, text); return null }
    try { return JSON.parse(text) } catch { return { raw: text } }
  } catch (err) {
    console.error('[retrieveEmail] Erro:', err)
    return null
  }
}

// ─── 1. Confirmação de reserva ───────────────────────────────────────────────────────────────
export function buildReservationConfirmationEmail({ reservaId, clientName, clientEmail,
  dataHora, serviceName, barberName, duracao, comentario }) {

  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
  const { dtStart, dtEnd } = icsParams(dataHora, duracao)

  const notasHtml = comentario ? detailRow('&#128172;', 'Notas:', `<br>${comentario}`) : ''

  const html = shell('header-green', 'Reserva Confirmada! &#9989;', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>A sua reserva foi confirmada com sucesso. Aqui estão os detalhes:</p>
    <div class="info-box border-green">
      <h3>Detalhes da Reserva</h3>
      ${detailRow('&#128197;', 'Data:', data)}
      ${detailRow('&#128341;', 'Hora:', hora)}
      ${detailRow('&#9986;&#65039;', 'Serviço:', serviceName)}
      ${detailRow('&#128100;', 'Barbeiro:', barberName)}
      ${notasHtml}
    </div>
    <div class="cta-sec">
      <p class="cta-text">Aguardamos por si! Se precisar de cancelar ou reagendar:</p>
      <a href="${SHOP.baseUrl}/reservations" class="btn">Ver as minhas reservas</a>
    </div>
    <div class="contact-sec">
      <p>Ou contacte-nos diretamente:</p>
      <a href="tel:${SHOP.phone.replace(/\s/g,'')}" class="contact-link">&#128222; ${SHOP.phone}</a>
    </div>
  `)

  const ics = icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName)
  return { html, attachments: [{ filename: 'reserva.ics', content: toBase64(ics), type: 'text/calendar' }] }
}

// ─── 2. Cancelamento de reserva ────────────────────────────────────────────────────────────
export function buildReservationCancellationEmail({ reservaId, clientName, clientEmail,
  dataHora, serviceName, barberName, duracao, motivo }) {

  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
  const { dtStart, dtEnd } = icsParams(dataHora, duracao)

  const motivoHtml = motivo
    ? `<div class="info-box border-amber"><h3>Motivo do Cancelamento</h3>
       <p class="reason-text">${motivo}</p></div>`
    : ''

  const html = shell('header-red', 'Reserva Cancelada', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Lamentamos informar que a sua reserva foi <strong>cancelada</strong>.</p>
    <div class="info-box border-red">
      <h3>Detalhes da Reserva Cancelada</h3>
      ${detailRow('&#128197;', 'Data:', data)}
      ${detailRow('&#128341;', 'Hora:', hora)}
      ${detailRow('&#9986;&#65039;', 'Serviço:', serviceName)}
      ${detailRow('&#128100;', 'Barbeiro:', barberName)}
    </div>
    ${motivoHtml}
    <div class="cta-sec">
      <p class="cta-text">Pedimos desculpa pelo inconveniente. Pode fazer uma nova reserva a qualquer momento:</p>
      <a href="${SHOP.baseUrl}/reservar" class="btn">Fazer Nova Reserva</a>
    </div>
    <div class="contact-sec">
      <p>Se tiver alguma dúvida, não hesite em contactar-nos:</p>
      <a href="tel:${SHOP.phone.replace(/\s/g,'')}" class="contact-link">&#128222; ${SHOP.phone}</a>
    </div>
  `)

  const ics = icsCancelled(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName)
  return { html, attachments: [{ filename: 'cancelamento.ics', content: toBase64(ics), type: 'text/calendar' }] }
}

// ─── 3. Verificação de conta ────────────────────────────────────────────────────────────────
export function buildVerificationEmail({ clientName, verifyToken }) {
  const verifyUrl = `${SHOP.baseUrl}/api/auth/verify?token=${verifyToken}`

  const html = shell('header-gold', 'Confirme o seu email &#128231;', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Bem-vindo à ${SHOP.name}! Por favor confirme o seu email para ativar a conta:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${verifyUrl}" class="btn">Verificar Email</a>
    </div>
    <p style="font-size:14px;color:#888">Ou copie este link:</p>
    <p style="word-break:break-all;font-size:12px;color:#2d4a3e">${verifyUrl}</p>
    <div class="warn">
      <p><strong>&#9888;&#65039;</strong> Este link expira em <strong>24 horas</strong>.</p>
      <p>Se não criou esta conta, ignore este email.</p>
    </div>
  `)

  return { html }
}

// ─── 4. Confirmação de alteração de email ──────────────────────────────────────────────────
export function buildEmailChangeEmail({ clientName, confirmToken, newEmail }) {
  const confirmUrl = `${SHOP.baseUrl}/confirmar-email?token=${confirmToken}`

  const html = shell('header-gold', 'Confirme o novo email &#128231;', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Recebemos um pedido para alterar o email da sua conta para <strong>${newEmail}</strong>.</p>
    <p>Para confirmar esta alteração, clique no botão abaixo:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${confirmUrl}" class="btn">Confirmar novo email</a>
    </div>
    <p style="font-size:14px;color:#888">Ou copie este link:</p>
    <p style="word-break:break-all;font-size:12px;color:#2d4a3e">${confirmUrl}</p>
    <div class="warn">
      <p><strong>&#9888;&#65039;</strong> Este link expira em <strong>24 horas</strong>.</p>
      <p>Se não pediu esta alteração, ignore este email &mdash; a sua conta não será alterada.</p>
    </div>
  `)

  return { html }
}

// ─── 5. Recuperação de password ────────────────────────────────────────────────────────────
export function buildPasswordResetEmail({ clientName, resetToken }) {
  const resetUrl = `${SHOP.baseUrl}/recuperar-password?token=${resetToken}`

  const html = shell('header-gold', 'Recuperação de Password &#128273;', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Recebemos um pedido para redefinir a password da sua conta.</p>
    <p>Se foi você que fez este pedido, clique no botão abaixo:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${resetUrl}" class="btn">Redefinir Password</a>
    </div>
    <div class="warn">
      <p><strong>&#9888;&#65039; Importante:</strong></p>
      <p>&bull; Este link expira em <strong>1 hora</strong>.</p>
      <p>&bull; Se não solicitou esta recuperação, ignore e descarte este email.</p>
      <p>&bull; A sua password atual permanecerá válida até que defina uma nova.</p>
    </div>
    <p style="font-size:12px;color:#888">Se o botão não funcionar, copie este link:</p>
    <p style="word-break:break-all;font-size:12px;color:#2d4a3e">${resetUrl}</p>
  `)

  return { html }
}
