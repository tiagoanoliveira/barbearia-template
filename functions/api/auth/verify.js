import { badRequest, notFound, serverError, corsOptions } from '../../utils/response.js'

function htmlRedirect(destination, message) {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="2;url=${destination}" />
  <title>Email verificado</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #030712; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .box { text-align: center; max-width: 360px; padding: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    p { color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem; }
    a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">✅</div>
    <h1>${message}</h1>
    <p>A redirecionar… Se não acontecer, <a href="${destination}">clica aqui</a>.</p>
  </div>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  })
}

function htmlError(message) {
  const html = `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8" />
  <title>Erro</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #030712; color: #fff;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; }
    .box { text-align: center; max-width: 360px; padding: 2rem; }
    .icon { font-size: 3rem; margin-bottom: 1rem; }
    p { color: #9ca3af; font-size: 0.9rem; margin-top: 0.5rem; }
    a { color: #f59e0b; text-decoration: none; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">❌</div>
    <h1>${message}</h1>
    <p><a href="/login">Voltar ao login</a></p>
  </div>
</body>
</html>`

  return new Response(html, {
    status: 400,
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  })
}

export async function onRequest(context) {
  const { request, env } = context

  if (request.method === 'OPTIONS') return corsOptions()

  const url   = new URL(request.url)
  const token = url.searchParams.get('token')

  if (!token) return htmlError('Token em falta.')

  try {
    const client = await env.DB.prepare(
      `SELECT id, email_verificado, token_verificacao_expira
       FROM clientes
       WHERE token_verificacao = ?`
    ).bind(token).first()

    if (!client) return htmlError('Token inválido ou já utilizado.')

    if (client.email_verificado) {
      return htmlRedirect('/login?verified=1', 'Email já verificado!')
    }

    const expRaw = client.token_verificacao_expira
    if (expRaw && Date.parse(expRaw) < Date.now()) {
      return htmlError('Link expirado. Solicita um novo email de verificação.')
    }

    await env.DB.prepare(
      `UPDATE clientes
          SET email_verificado         = 1,
              token_verificacao        = NULL,
              token_verificacao_expira = NULL,
              atualizado_em            = CURRENT_TIMESTAMP
        WHERE id = ?`
    ).bind(client.id).run()

    return htmlRedirect('/login?verified=1', 'Email verificado com sucesso!')

  } catch (e) {
    return serverError('Erro ao verificar email', e.message)
  }
}
