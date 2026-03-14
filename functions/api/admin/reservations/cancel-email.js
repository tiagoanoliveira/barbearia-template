import { createResponse, createErrorResponse, authenticateAdmin } from '../../../utils/auth.js'
import { getDB } from '../../../utils/db.js'
import { sendEmail } from '../../../utils/email.js'

export async function onRequestPost(context) {
  const auth = await authenticateAdmin(context)
  if (!auth.success) return createErrorResponse(auth.error, 401)

  const { reservation_id, reason } = await context.request.json()
  if (!reservation_id) return createErrorResponse('reservation_id obrigatório', 400)

  const db = getDB(context)
  const row = await db.prepare(`
    SELECT r.id, r.data_hora, r.nota_privada,
           c.email AS client_email, c.nome AS client_name,
           s.nome AS service_name,
           b.nome AS barber_name
    FROM   reservas r
    JOIN   clientes c ON r.cliente_id = c.id
    JOIN   servicos s ON r.servico_id = s.id
    JOIN   barbeiros b ON r.barbeiro_id = b.id
    WHERE  r.id = ?
  `).bind(reservation_id).first()

  if (!row) return createErrorResponse('Reserva não encontrada', 404)
  if (!row.client_email) return createResponse({ ok: true, message: 'Sem email – não enviado' })

  const dt = new Date(row.data_hora)
  const dateStr = dt.toLocaleDateString('pt-PT', { weekday:'long', year:'numeric', month:'long', day:'numeric' })
  const timeStr = dt.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })

  const reasonBlock = reason
    ? `<p style="margin:16px 0 0"><strong>Motivo:</strong> ${reason}</p>`
    : ''

  const html = `
<!DOCTYPE html><html lang="pt"><head><meta charset="UTF-8" />
<style>body{font-family:Arial,sans-serif;color:#333;background:#f9f9f9;margin:0;padding:0}
.wrap{max-width:520px;margin:32px auto;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08)}
.hd{background:#1a1a1a;padding:24px 32px;text-align:center}
.hd h1{color:#d4a017;margin:0;font-size:22px;letter-spacing:.5px}    
.body{padding:28px 32px}
h2{font-size:18px;margin:0 0 16px}
.info{background:#f5f5f5;border-radius:6px;padding:14px 18px;margin:16px 0}
.info p{margin:6px 0;font-size:14px}
.footer{font-size:12px;color:#888;text-align:center;padding:16px 32px;border-top:1px solid #eee}
</style></head>
<body><div class="wrap">
  <div class="hd"><h1>Brooklyn Barbearia</h1></div>
  <div class="body">
    <h2>Reserva Cancelada</h2>
    <p>Olá ${row.client_name},</p>
    <p>A tua reserva foi cancelada. Pedimos desculpa pelo inconveniente.</p>
    <div class="info">
      <p><strong>Serviço:</strong> ${row.service_name}</p>
      <p><strong>Barbeiro:</strong> ${row.barber_name}</p>
      <p><strong>Data:</strong> ${dateStr}</p>
      <p><strong>Hora:</strong> ${timeStr}</p>
    </div>
    ${reasonBlock}
    <p style="margin-top:20px">Podes fazer uma nova marcação quando quiseres.</p>
  </div>
  <div class="footer">Brooklyn Barbearia &bull; Este email foi gerado automaticamente</div>
</div></body></html>`

  await sendEmail(context, {
    to:      row.client_email,
    subject: 'A tua reserva foi cancelada – Brooklyn Barbearia',
    html,
  })

  // Guardar motivo na nota_privada
  if (reason) {
    const existing = row.nota_privada ?? ''
    const nota = existing
      ? `${existing}\n[Cancelamento] ${reason}`
      : `[Cancelamento] ${reason}`
    await db.prepare('UPDATE reservas SET nota_privada = ? WHERE id = ?').bind(nota, reservation_id).run()
  }

  return createResponse({ ok: true, message: 'Email enviado' })
}
