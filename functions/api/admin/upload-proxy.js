/**
 * POST /api/admin/upload-proxy
 * multipart/form-data: file (Blob/File) + key (string)
 *
 * O Cloudflare Workers suporta nativamente FormData — não precisamos
 * de qualquer parser externo. O binding R2 é acedido via env.BUCKET.
 */
export async function onRequest(context) {
  const { request, env } = context

  // CORS preflight
  const corsHeaders = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders })

  if (request.method !== 'POST')
    return json({ success: false, error: 'Método não suportado' }, 405, corsHeaders)

  // Autenticação — aceita Bearer token de admin
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return json({ success: false, error: 'Não autenticado' }, 401, corsHeaders)

  // Verificação JWT simples (igual ao resto da API de admin)
  try {
    const [, payloadB64] = token.split('.')
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')))
    if (!payload?.role || payload.role !== 'admin' && payload.role !== 'barbeiro')
      return json({ success: false, error: 'Acesso negado' }, 403, corsHeaders)
    if (payload.exp && payload.exp * 1000 < Date.now())
      return json({ success: false, error: 'Sessão expirada' }, 401, corsHeaders)
  } catch {
    return json({ success: false, error: 'Token inválido' }, 401, corsHeaders)
  }

  // Bindings
  const bucket     = env.BUCKET
  const publicBase = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')
  if (!bucket)     return json({ success: false, error: 'R2 bucket binding não configurado' }, 500, corsHeaders)
  if (!publicBase) return json({ success: false, error: 'R2_PUBLIC_URL não configurado' }, 500, corsHeaders)

  // Parse do formulário
  let formData
  try { formData = await request.formData() }
  catch { return json({ success: false, error: 'Corpo inválido — esperado multipart/form-data' }, 400, corsHeaders) }

  const file = formData.get('file')
  const key  = formData.get('key')

  if (!file || typeof file === 'string')
    return json({ success: false, error: 'Campo file em falta ou inválido' }, 400, corsHeaders)
  if (!key || typeof key !== 'string')
    return json({ success: false, error: 'Campo key em falta' }, 400, corsHeaders)

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowed.includes(file.type))
    return json({ success: false, error: `Tipo não permitido: ${file.type}` }, 400, corsHeaders)
  if (file.size > 5 * 1024 * 1024)
    return json({ success: false, error: 'Ficheiro demasiado grande (máx. 5 MB)' }, 400, corsHeaders)

  // Upload para R2
  try {
    const buffer = await file.arrayBuffer()
    await bucket.put(key, buffer, { httpMetadata: { contentType: file.type } })
  } catch (e) {
    console.error('[upload-proxy] R2 error:', e?.message ?? e)
    return json({ success: false, error: 'Erro ao guardar no R2', detail: e?.message }, 500, corsHeaders)
  }

  return json({ success: true, data: { publicUrl: `${publicBase}/${key}` } }, 200, corsHeaders)
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}
