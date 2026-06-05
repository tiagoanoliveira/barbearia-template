import { serverError, corsOptions } from '../../utils/response.js'

function htmlPage({ icon, title, message, destination, isError }) {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #030712; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .box { text-align: center; max-width: 380px; padding: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    h1 { font-size: 1.25rem; margin: 0 0 0.5rem; }
    p { color: #9ca3af; font-size: 0.9rem; margin: 0.5rem 0 0; }
    .btn { display: inline-block; margin-top: 1.5rem; padding: 0.75rem 1.5rem;
           background: #f59e0b; color: #000; font-weight: 600; border-radius: 0.75rem;
           text-decoration: none; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${destination ? `<a class="btn" href="${destination}" target="_top">${isError ? 'Voltar ao login' : 'Ir para o login →'}</a>` : ''}
  </div>
</body>
</html>`

  return new Response(html, {
    status: isError ? 400 : 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const url   = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return htmlPage({ icon: '❌', title: 'Token em falta', message: 'O link de verificação é inválido.', destination: '/login', isError: true })
  }

  try {
    const client = await env.DB.prepare(
      `SELECT id, email_verificado, token_verificacao_expira
       FROM clientes
       WHERE token_verificacao = ?`
    ).bind(token).first()

    if (!client) {
      return htmlPage({ icon: '❌', title: 'Link inválido', message: 'Este link já foi utilizado ou não existe.', destination: '/login', isError: true })
    }

    if (client.email_verificado) {
      return htmlPage({ icon: '✅', title: 'Email já verificado!', message: 'A tua conta já estava confirmada.', destination: '/login?verified=1', isError: false })
    }

    const expRaw = client.token_verificacao_expira
    if (expRaw && Date.parse(expRaw) < Date.now()) {
      return htmlPage({ icon: '⏰', title: 'Link expirado', message: 'Solicita um novo email de verificação no teu perfil.', destination: '/login', isError: true })
    }

    await env.DB.prepare(
      `UPDATE clientes
          SET email_verificado         = 1,
              token_verificacao        = NULL,
              token_verificacao_expira = NULL,
              atualizado_em            = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).bind(client.id).run()

    return htmlPage({ icon: '✅', title: 'Email verificado!', message: 'A tua conta foi confirmada com sucesso.', destination: '/login?verified=1', isError: false })

  } catch (e) {
    return serverError('Erro ao verificar email', e.message)
  }
}
