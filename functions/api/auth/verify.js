import { serverError, corsOptions } from '../../utils/response.js'

function page({ icon, title, subtitle, linkHref, linkLabel, isError = false }) {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — Brooklyn Barbearia</title>
  <style>
    *,*::before,*::after{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,sans-serif;
         background:#030712;color:#fff;
         min-height:100vh;display:flex;align-items:center;justify-content:center;padding:1rem}
    .card{background:#111827;border:1px solid #1f2937;border-radius:1rem;
          padding:2.5rem 2rem;max-width:380px;width:100%;text-align:center}
    .icon{font-size:3.5rem;line-height:1;margin-bottom:1rem}
    h1{margin:0 0 .5rem;font-size:1.3rem;font-weight:700}
    p{margin:0 0 1.5rem;color:#9ca3af;font-size:.9rem;line-height:1.5}
    .btn{display:inline-block;padding:.8rem 1.6rem;border-radius:.75rem;
         background:${isError ? '#374151' : '#f59e0b'};
         color:${isError ? '#fff' : '#000'};
         font-weight:700;font-size:.9rem;text-decoration:none}
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${subtitle}</p>
    <a class="btn" href="${linkHref}" target="_top" rel="noopener noreferrer">${linkLabel}</a>
  </div>
</body>
</html>`

  return new Response(html, {
    status: isError ? 400 : 200,
    headers: {
      'Content-Type': 'text/html; charset=UTF-8',
    },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const url    = new URL(request.url)
  const token  = url.searchParams.get('token')
  const origin = url.origin  // ex: https://brooklynbarbearia.pt

  const loginUrl         = `${origin}/login`
  const loginVerifiedUrl = `${origin}/login?verified=1`

  if (!token) {
    return page({
      icon: '❌', title: 'Link inválido',
      subtitle: 'O link de verificação não contém um token válido.',
      linkHref: loginUrl, linkLabel: 'Ir para o login', isError: true,
    })
  }

  try {
    const client = await env.DB.prepare(
      `SELECT id, email_verificado, token_verificacao_expira
       FROM clientes WHERE token_verificacao = ?`
    ).bind(token).first()

    if (!client) {
      return page({
        icon: '❌', title: 'Link inválido ou expirado',
        subtitle: 'Este link já foi utilizado ou não existe. Podes fazer login normalmente.',
        linkHref: loginUrl, linkLabel: 'Ir para o login', isError: true,
      })
    }

    if (client.email_verificado) {
      return page({
        icon: '✅', title: 'Email já verificado',
        subtitle: 'A tua conta já estava confirmada. Podes fazer login.',
        linkHref: loginVerifiedUrl, linkLabel: 'Fazer login →',
      })
    }

    const expRaw = client.token_verificacao_expira
    if (expRaw && Date.parse(expRaw) < Date.now()) {
      return page({
        icon: '⏰', title: 'Link expirado',
        subtitle: 'Este link de verificação expirou (válido 24h). Faz login e solicita um novo email.',
        linkHref: loginUrl, linkLabel: 'Ir para o login', isError: true,
      })
    }

    await env.DB.prepare(
      `UPDATE clientes
          SET email_verificado         = 1,
              token_verificacao        = NULL,
              token_verificacao_expira = NULL,
              atualizado_em            = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).bind(client.id).run()

    return page({
      icon: '✅', title: 'Email verificado!',
      subtitle: 'A tua conta foi confirmada com sucesso. Podes agora fazer login e gerir as tuas reservas.',
      linkHref: loginVerifiedUrl, linkLabel: 'Fazer login →',
    })

  } catch (e) {
    return serverError('Erro ao verificar email', e.message)
  }
}
