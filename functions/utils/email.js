/**
 * Utilitário de envio de email via Resend
 * Usado por todos os endpoints que precisam de enviar emails.
 */

const FROM = 'Brooklyn Barbearia <noreply@brooklynbarbearia.pt>'
const BASE_URL = 'https://brooklynbarbearia.pt'
const YEAR = new Date().getFullYear()

// ─── CSS partilhado ───────────────────────────────────────────────────────────
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
    <img src="${BASE_URL}/images/logos/logo-512px.svg" alt="Brooklyn Barbearia" class="logo">
  </div>
  <div class="${headerClass}"><h1>${headerTitle}</h1></div>
  <div class="content">${body}</div>
  <div class="footer">
    <p style="font-size:12px;color:#718096">Este é um email automático, por favor não responda.</p>
    <p>&copy; ${YEAR} Brooklyn Barbearia – Todos os direitos reservados.
       Feito com 🤍 por <a href="https://www.tiagoanoliveira.pt">Tiago Oliveira</a>.</p>
  </div>
</div></div></body></html>`
}

function detailRow(icon, label, value) {
  return `<div class="detail-row"><span class="di">${icon}</span>
<div class="dc"><strong>${label}</strong>${value}</div></div>`
}

function icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName) {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Brooklyn Barbearia//Reservas//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:REQUEST\r\nBEGIN:VEVENT\r\nUID:reserva-${reservaId}@brooklynbarbearia.pt\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z\r\nDTSTART:${dtStart}\r\nDTEND:${dtEnd}\r\nSUMMARY:Reserva – ${serviceName} com ${barberName}\r\nDESCRIPTION:Confirmação de reserva na Brooklyn Barbearia\r\nLOCATION:Brooklyn Barbearia\r\nORGANIZER:CN=Brooklyn Barbearia:mailto:noreply@brooklynbarbearia.pt\r\nATTENDEE:mailto:${clientEmail}\r\nSTATUS:CONFIRMED\r\nSEQUENCE:0\r\nEND:VEVENT\r\nEND:VCALENDAR`
}

function icsCancelled(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName) {
  return `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Brooklyn Barbearia//Reservas//EN\r\nCALSCALE:GREGORIAN\r\nMETHOD:CANCEL\r\nBEGIN:VEVENT\r\nUID:reserva-${reservaId}@brooklynbarbearia.pt\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').split('.')[0]}Z\r\nDTSTART:${dtStart}\r\nDTEND:${dtEnd}\r\nSUMMARY:CANCELADA – ${serviceName} com ${barberName}\r\nDESCRIPTION:Esta reserva foi cancelada pela Brooklyn Barbearia\r\nLOCATION:Brooklyn Barbearia\r\nORGANIZER:CN=Brooklyn Barbearia:mailto:noreply@brooklynbarbearia.pt\r\nATTENDEE:mailto:${clientEmail}\r\nSTATUS:CANCELLED\r\nSEQUENCE:1\r\nEND:VEVENT\r\nEND:VCALENDAR`
}

function icsParams(dataHora, duracao) {
  const dt   = new Date(dataHora)
  const pad  = n => String(n).padStart(2,'0')
  const fmt  = d => `${d.getFullYear()}${pad(d.getMonth()+1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00Z`
  const dtEnd = new Date(dt.getTime() + (duracao || 60) * 60000)
  return { dtStart: fmt(dt), dtEnd: fmt(dtEnd) }
}

// ─── Envio central ────────────────────────────────────────────────────────────
export async function sendEmail(context, { to, subject, html, attachments = [] }) {
  const key = context.env?.RESEND_API_KEY
  if (!key) throw new Error('RESEND_API_KEY não configurada')

  const body = { from: FROM, to, subject, html }
  if (attachments.length) body.attachments = attachments

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend error ${res.status}: ${err}`)
  }
  return res.json()
}

// ─── 1. Email de confirmação de reserva ───────────────────────────────────────
export function buildReservationConfirmationEmail({ reservaId, clientName, clientEmail,
  dataHora, serviceName, barberName, duracao, comentario }) {

  const dt      = new Date(dataHora)
  const data    = dt.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' })
  const hora    = dt.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
  const { dtStart, dtEnd } = icsParams(dataHora, duracao)

  const notasHtml = comentario
    ? detailRow('💬','Notas:',`<br>${comentario}`)
    : ''

  const html = shell('header-green','Reserva Confirmada! ✅',`
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>A sua reserva foi confirmada com sucesso. Aqui estão os detalhes:</p>
    <div class="info-box border-green">
      <h3>Detalhes da Reserva</h3>
      ${detailRow('📅','Data:',data)}
      ${detailRow('🕕','Hora:',hora)}
      ${detailRow('✂️','Serviço:',serviceName)}
      ${detailRow('👤','Barbeiro:',barberName)}
      ${notasHtml}
    </div>
    <div class="cta-sec">
      <p class="cta-text">Aguardamos por si! Se precisar de cancelar ou reagendar:</p>
      <a href="${BASE_URL}/reservations" class="btn">Ver as minhas reservas</a>
    </div>
    <div class="contact-sec">
      <p>Ou contacte-nos diretamente:</p>
      <a href="tel:+351224938542" class="contact-link">📞 +351 224 938 542</a>
    </div>
  `)

  const ics = icsConfirmed(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName)

  return {
    html,
    attachments: [{ filename: 'reserva.ics', content: btoa(ics), type: 'text/calendar' }],
  }
}

// ─── 2. Email de cancelamento de reserva ─────────────────────────────────────
export function buildReservationCancellationEmail({ reservaId, clientName, clientEmail,
  dataHora, serviceName, barberName, duracao, motivo }) {

  const dt   = new Date(dataHora)
  const data = dt.toLocaleDateString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric' })
  const hora = dt.toLocaleTimeString('pt-PT', { hour:'2-digit', minute:'2-digit' })
  const { dtStart, dtEnd } = icsParams(dataHora, duracao)

  const motivoHtml = motivo
    ? `<div class="info-box border-amber">
         <h3>Motivo do Cancelamento</h3>
         <p class="reason-text">${motivo}</p>
       </div>`
    : ''

  const html = shell('header-red','Reserva Cancelada',`
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Lamentamos informar que a sua reserva foi <strong>cancelada</strong>.</p>
    <div class="info-box border-red">
      <h3>Detalhes da Reserva Cancelada</h3>
      ${detailRow('📅','Data:',data)}
      ${detailRow('🕕','Hora:',hora)}
      ${detailRow('✂️','Serviço:',serviceName)}
      ${detailRow('👤','Barbeiro:',barberName)}
    </div>
    ${motivoHtml}
    <div class="cta-sec">
      <p class="cta-text">Pedimos desculpa pelo inconveniente. Pode fazer uma nova reserva a qualquer momento:</p>
      <a href="${BASE_URL}/reservar" class="btn">Fazer Nova Reserva</a>
    </div>
    <div class="contact-sec">
      <p>Se tiver alguma dúvida, não hesite em contactar-nos:</p>
      <a href="tel:+351224938542" class="contact-link">📞 +351 224 938 542</a>
    </div>
  `)

  const ics = icsCancelled(reservaId, clientEmail, dtStart, dtEnd, serviceName, barberName)

  return {
    html,
    attachments: [{ filename: 'cancelamento.ics', content: btoa(ics), type: 'text/calendar' }],
  }
}

// ─── 3. Email de verificação de conta ────────────────────────────────────────
export function buildVerificationEmail({ clientName, verifyToken }) {
  const verifyUrl = `${BASE_URL}/api/auth/verify?token=${verifyToken}`

  const html = shell('header-gold','Confirme o seu email 📧',`
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Bem-vindo à Brooklyn Barbearia! Por favor confirme o seu email para ativar a conta:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${verifyUrl}" class="btn">Verificar Email</a>
    </div>
    <p style="font-size:14px;color:#888">Ou copie este link:</p>
    <p style="word-break:break-all;font-size:12px;color:#2d4a3e">${verifyUrl}</p>
    <div class="warn">
      <p><strong>⚠️</strong> Este link expira em <strong>24 horas</strong>.</p>
      <p>Se não criou esta conta, ignore este email.</p>
    </div>
  `)

  return { html }
}

// ─── 4. Email de recuperação de password ─────────────────────────────────────
export function buildPasswordResetEmail({ clientName, resetToken }) {
  const resetUrl = `${BASE_URL}/reset-password?token=${resetToken}`

  const html = shell('header-gold','Recuperação de Password 🔑',`
    <p>Olá <strong>${clientName}</strong>,</p>
    <p>Recebemos um pedido para redefinir a password da sua conta.</p>
    <p>Se foi você que fez este pedido, clique no botão abaixo:</p>
    <div style="text-align:center;margin:30px 0">
      <a href="${resetUrl}" class="btn">Redefinir Password</a>
    </div>
    <div class="warn">
      <p><strong>⚠️ Importante:</strong></p>
      <p>• Este link expira em <strong>1 hora</strong>.</p>
      <p>• Se não solicitou esta recuperação, ignore e descarte este email.</p>
      <p>• A sua password atual permanecerá válida até que defina uma nova.</p>
    </div>
    <p style="font-size:12px;color:#888">Se o botão não funcionar, copie este link:</p>
    <p style="word-break:break-all;font-size:12px;color:#2d4a3e">${resetUrl}</p>
  `)

  return { html }
}
