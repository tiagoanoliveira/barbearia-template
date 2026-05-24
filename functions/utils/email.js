/**
 * Utilitário de envio de email via Resend.
 * Usado por todos os endpoints que precisam de enviar emails.
 *
 * Todos os dados da barbearia (nome, domínio, contacto, cores) são importados
 * de functions/utils/site-config.js — edite apenas aí.
 */

import { SHOP, LOGO_URL, LOGO_ALT, EMAIL_COLORS as C } from './site-config.js'

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
         line-height:1.6;background:${C.bodyBg}}
    .wrap{background:linear-gradient(135deg,${C.wrapBgFrom},${C.wrapBgTo});min-height:100vh}
    .container{max-width:600px;margin:0 auto;background:${C.containerBg};border-radius:16px;
               overflow:hidden;box-shadow:0 10px 40px ${C.containerShadow}}
    .logo-sec{background:${C.logoBg};text-align:center;padding:20px}
    .logo{max-width:70px;height:auto}
    .header-green{background:linear-gradient(135deg,${C.headerGreenFrom},${C.headerGreenTo});color:#fff;
                  padding:20px;text-align:center}
    .header-red{background:linear-gradient(135deg,${C.headerRedFrom},${C.headerRedTo});color:#fff;
                padding:20px;text-align:center}
    .header-gold{background:linear-gradient(135deg,${C.headerGoldFrom},${C.headerGoldTo});color:#fff;
                 padding:20px;text-align:center}
    .header-amber{background:linear-gradient(135deg,${C.headerAmberFrom},${C.headerAmberTo});color:#fff;
                  padding:20px;text-align:center}
    .header-green h1,.header-red h1,.header-gold h1,.header-amber h1{margin:0;font-size:20px;
      font-weight:600;letter-spacing:-.5px}
    .content{padding:20px}
    .content p{color:${C.contentText};font-size:15px;margin-bottom:10px}
    .content strong{color:${C.contentStrong};font-weight:600}
    .info-box{background:${C.infoBoxBg};border-radius:12px;padding:15px;margin:10px 0;
              border:1px solid ${C.infoBoxBorder}}
    .info-box h3{color:${C.infoBoxTitle};font-size:15px;margin-bottom:10px;font-weight:600}
    .border-green{border-left:4px solid ${C.borderGreen}}
    .border-red{border-left:4px solid ${C.borderRed}}
    .border-amber{border-left:4px solid ${C.borderAmber};background:${C.infoBoxAmberBg}}
    .border-reminder{border-left:4px solid ${C.borderAmber};background:${C.infoBoxReminderBg};
                     border-color:${C.infoBoxReminderBorder}}
    .border-reminder h3{color:${C.infoBoxReminderTitle}}
    .detail-row{display:flex;align-items:center;margin-bottom:10px;
                padding:10px;background:${C.detailRowBg};border-radius:8px}
    .detail-row:last-child{margin-bottom:0}
    .di{font-size:20px;margin-right:10px;min-width:24px}
    .dc{font-size:14px}
    .dc strong{color:${C.contentStrong};margin-bottom:2px}
    .reason-text{color:${C.reasonText};font-style:italic;margin:0;padding:10px 15px;
                 background:${C.reasonBg};border-radius:8px}
    .cta-sec{text-align:center;margin:10px 0;padding:15px;
             background:linear-gradient(135deg,${C.ctaGreenBgFrom},${C.ctaGreenBgTo});border-radius:12px}
    .cta-sec.amber{background:linear-gradient(135deg,${C.ctaAmberBgFrom},${C.ctaAmberBgTo})}
    .cta-text{color:${C.ctaGreenText};font-size:15px;margin-bottom:20px}
    .cta-text.amber{color:${C.ctaAmberText}}
    .btn{display:inline-block;background:linear-gradient(135deg,${C.btnBgFrom},${C.btnBgTo});
         color:#fff!important;text-decoration:none;padding:10px 15px;
         border-radius:8px;font-weight:600;font-size:15px;
         box-shadow:0 4px 12px ${C.btnShadow}}
    .stars{font-size:28px;letter-spacing:4px;margin-bottom:12px}
    .contact-sec{margin-top:15px;text-align:center}
    .contact-link{display:inline-flex;align-items:center;color:${C.contactLinkText};
                  text-decoration:none;font-weight:600;font-size:15px;
                  padding:10px 15px;background:${C.contactLinkBg};border-radius:8px}
    .warn{background:${C.warnBg};border-left:4px solid ${C.warnBorder};padding:12px;margin:20px 0}
    .footer{background:${C.footerBg};color:${C.footerText};text-align:center;padding:20px}
    .footer p{margin:8px 0;font-size:14px}
    .footer a{color:${C.footerLink};text-decoration:none}
  `
}

/**
 * Estrutura base de todos os emails.
 * Exportada para que outros módulos (ex: reservationEmails.js) possam reutilizá-la
 * sem duplicar HTML de logo, cabeçalho e rodapé.
 *
 * @param {string} headerClass  - Classe CSS do header (header-green, header-red, header-gold, header-amber)
 * @param {string} headerTitle  - Conteúdo HTML do <h1> no header
 * @param {string} body         - Conteúdo HTML da secção .content
 */
export function shell(headerClass, headerTitle, body) {
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
    <p style="font-size:12px;color:${C.footerMeta}">Este é um email automático, por favor não responda.</p>
    <p>&copy; ${new Date().getFullYear()} ${SHOP.name} &ndash; Todos os direitos reservados.
       Feito com &#129293; por <a href="https://www.tiagoanoliveira.pt">Tiago Oliveira</a>.</p>
  </div>
</div></div></body></html>`
}

/**
 * Linha de detalhe reutilizável (ícone + label + valor).
 * Exportada para reutilização em outros templates.
 */
export function detailRow(icon, label, value) {
  return `<div class="detail-row"><span class="di">${icon}</span>
<div class="dc"><strong>${label}</strong> ${value}</div></div>`
}

// ─── Bloco VTIMEZONE para Europe/Lisbon (inclui regras DST WEST/WET) ──────────────────
const VTIMEZONE_LISBON = [
  'BEGIN:VTIMEZONE',
  'TZID:Europe/Lisbon',
  'BEGIN:STANDARD',
  'DTSTART:19701025T020000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=10',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0000',
  'TZNAME:WET',
  'END:STANDARD',
  'BEGIN:DAYLIGHT',
  'DTSTART:19700329T010000',
  'RRULE:FREQ=YEARLY;BYDAY=-1SU;BYMONTH=3',
  'TZOFFSETFROM:+0000',
  'TZOFFSETTO:+0100',
  'TZNAME:WEST',
  'END:DAYLIGHT',
  'END:VTIMEZONE',
].join('\r\n')

/**
 * Formata dataHora ("YYYY-MM-DDTHH:MM:SS", hora local Lisboa sem TZ)
 * para o formato ICS local: YYYYMMDDTHHMMSS (sem Z).
 * Usado com TZID=Europe/Lisbon para que os clientes de calendário
 * interpretem a hora correctamente, incluindo hora de verão (WEST = UTC+1).
 *
 * IMPORTANTE: NÃO usar o sufixo Z nem getUTCHours() — a string dataHora
 * já está em hora de Lisboa, por isso parseamos os componentes directamente.
 */
function icsParams(dataHora, duracao) {
  const pad = n => String(n).padStart(2, '0')

  // Parsear os componentes directamente da string (sem conversão de fuso)
  const [datePart, timePart] = dataHora.split('T')
  const [year, month, day]  = datePart.split('-').map(Number)
  const [hour, minute]      = timePart.split(':').map(Number)

  const fmtLocal = (y, mo, d, h, mi) =>
    `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(mi)}00`

  const dtStart = fmtLocal(year, month, day, hour, minute)

  // Calcular a hora de fim adicionando a duração em minutos
  const totalMinutes = hour * 60 + minute + (duracao || 60)
  const endHour   = Math.floor(totalMinutes / 60) % 24
  const endMinute = totalMinutes % 60
  // Lidar com reservas que passam da meia-noite (adiciona 1 dia)
  const dayOverflow = Math.floor((hour * 60 + minute + (duracao || 60)) / (24 * 60))
  let endDay   = day   + dayOverflow
  let endMonth = month
  let endYear  = year
  if (dayOverflow > 0) {
    // Recalcular data de fim usando Date UTC (só para aritmética de calendário)
    const endDate = new Date(Date.UTC(year, month - 1, day + dayOverflow))
    endYear  = endDate.getUTCFullYear()
    endMonth = endDate.getUTCMonth() + 1
    endDay   = endDate.getUTCDate()
  }

  const dtEnd = fmtLocal(endYear, endMonth, endDay, endHour, endMinute)

  return { dtStart, dtEnd }
}

/**
 * Gera um ICS de confirmação (METHOD:REQUEST).
 * sequence — número de edições já registadas, usado para sobrescrever o evento
 *            no calendário do cliente sem criar um duplicado.
 *            0 = criação inicial; N>0 = actualização.
 */
function icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName, sequence = 0) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${SHOP.name}//Reservas//PT`,
    'CALSCALE:GREGORIAN', 'METHOD:REQUEST',
    VTIMEZONE_LISBON,
    'BEGIN:VEVENT',
    `UID:reserva-${reservaId}@${new URL(SHOP.baseUrl).hostname}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART;TZID=Europe/Lisbon:${dtStart}`,
    `DTEND;TZID=Europe/Lisbon:${dtEnd}`,
    `SUMMARY:Reserva - ${serviceName} com ${barberName}`,
    `DESCRIPTION:Confirmacao de reserva na ${SHOP.name}`,
    `LOCATION:${SHOP.name} \u2013 ${SHOP.address}`,
    `ORGANIZER;CN=${SHOP.name}:mailto:${SHOP.email}`,
    `ATTENDEE:mailto:${clientEmail}`,
    'STATUS:CONFIRMED', `SEQUENCE:${sequence}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
}

function icsCancelled(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0',
    `PRODID:-//${SHOP.name}//Reservas//PT`,
    'CALSCALE:GREGORIAN', 'METHOD:CANCEL',
    VTIMEZONE_LISBON,
    'BEGIN:VEVENT',
    `UID:reserva-${reservaId}@${new URL(SHOP.baseUrl).hostname}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z`,
    `DTSTART;TZID=Europe/Lisbon:${dtStart}`,
    `DTEND;TZID=Europe/Lisbon:${dtEnd}`,
    `SUMMARY:CANCELADA - ${serviceName} com ${barberName}`,
    `DESCRIPTION:Esta reserva foi cancelada pela ${SHOP.name}`,
    `LOCATION:${SHOP.name} \u2013 ${SHOP.address}`,
    `ORGANIZER;CN=${SHOP.name}:mailto:${SHOP.email}`,
    `ATTENDEE:mailto:${clientEmail}`,
    'STATUS:CANCELLED', 'SEQUENCE:1',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
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
  dataHora, serviceName, barberName, duracao, comentario, sequence = 0 }) {

  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
  const { dtStart, dtEnd } = icsParams(dataHora, duracao)

  const notasHtml = comentario ? detailRow('&#128172;', 'Notas:', `<br>${comentario}`) : ''

  // Para atualizações (sequence > 0) usa título diferente no email
  const isUpdate    = sequence > 0
  const headerTitle = isUpdate ? 'Reserva Actualizada &#128197;' : 'Reserva Confirmada!'
  const introText   = isUpdate
    ? 'A sua reserva foi <strong>actualizada</strong>. Aqui estão os novos detalhes:'
    : 'A sua reserva foi confirmada com sucesso. Aqui estão os detalhes:'

  const html = shell('header-green', headerTitle, `
    <p>Olá ${clientName},</p>
    <p>${introText}</p>
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

  const ics = icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName, sequence)
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
    <p style="word-break:break-all;font-size:12px;color:${C.contactLinkText}">${verifyUrl}</p>
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
    <p style="word-break:break-all;font-size:12px;color:${C.contactLinkText}">${confirmUrl}</p>
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
    <p style="word-break:break-all;font-size:12px;color:${C.contactLinkText}">${resetUrl}</p>
  `)

  return { html }
}

// ─── 6. Lembrete de reserva ────────────────────────────────────────────────────────────────
/**
 * Exportada para uso em reservationEmails.js.
 * Usa shell() e detailRow() do mesmo módulo, eliminando HTML duplicado.
 */
export function buildReminderEmail({ clientName, data, hora, serviceName, barberName, reservaId }) {
  const html = shell('header-amber', '&#9200; Lembrete de Reserva', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Este é um lembrete de que tem uma reserva <strong>amanhã</strong>:</p>
    <div class="info-box border-reminder">
      <h3>&#128197; Detalhes da Reserva #${reservaId}</h3>
      ${detailRow('&#128197;', 'Data:', data)}
      ${detailRow('&#128341;', 'Hora:', hora)}
      ${detailRow('&#9986;&#65039;', 'Serviço:', serviceName)}
      ${detailRow('&#128100;', 'Barbeiro:', barberName)}
    </div>
    <div class="cta-sec amber">
      <p class="cta-text amber">Precisa de cancelar ou reagendar?</p>
      <a href="${SHOP.baseUrl}/reservations" class="btn">Gerir a minha reserva</a>
    </div>
  `)
  return { html }
}

// ─── 7. Pedido de avaliação Google ─────────────────────────────────────────────────────────
/**
 * Enviado quando uma reserva é marcada como concluída e SHOP.googleReviewUrl !== null.
 *
 * @param {object} params
 * @param {string} params.clientName   - Nome do cliente
 * @param {string} params.serviceName  - Nome do serviço realizado
 * @param {string} params.reviewUrl    - URL directo para o formulário de avaliação no Google
 */
export function buildReviewRequestEmail({ clientName, serviceName, reviewUrl }) {
  const html = shell('header-gold', '&#11088; Como foi a sua visita?', `
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Obrigado por nos visitar! Esperamos que tenha ficado satisfeito com o seu <strong>${serviceName}</strong>.</p>
    <p>A sua opinião é muito importante para nós e ajuda outros clientes a encontrar-nos. Levaria apenas <strong>30 segundos</strong>:</p>
    <div class="cta-sec" style="margin-top:20px">
      <div class="stars">&#11088;&#11088;&#11088;&#11088;&#11088;</div>
      <a href="${reviewUrl}" class="btn">Avaliar no Google</a>
    </div>
    <p style="font-size:13px;color:#999;text-align:center;margin-top:16px">Clique no botão acima para deixar a sua avaliação.<br>Obrigado pela confiança na ${SHOP.name}!</p>
  `)
  return { html }
}
