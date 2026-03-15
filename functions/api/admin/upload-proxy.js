/**
 * POST /api/admin/upload-proxy
 * multipart/form-data: file (File/Blob) + key (string)
 *
 * Autenticação: Bearer JWT emitido pelo login de admin.
 * Binding obrigatório: R2 (R2 bucket) + R2_PUBLIC_URL.
 */
export async function onRequest(context) {
  const { request, env } = context

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: cors })

  if (request.method !== 'POST')
    return json({ success: false, error: 'Método não suportado' }, 405, cors)

  // ── Verificação JWT manual (evita import de utils que requerem DB) ─────────
  const authHeader = request.headers.get('Authorization') ?? ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : ''

  console.log('[upload-proxy] token present:', !!token, '| length:', token.length)

  if (!token)
    return json({ success: false, error: 'Token em falta' }, 401, cors)

  let payload
  try {
    const parts = token.split('.')
    if (parts.length !== 3) throw new Error('formato JWT inválido')
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    payload = JSON.parse(atob(b64))
    console.log('[upload-proxy] JWT payload role:', payload?.role, '| exp:', payload?.exp)
  } catch (e) {
    console.error('[upload-proxy] JWT decode error:', e.message)
    return json({ success: false, error: 'Token inválido' }, 401, cors)
  }

  if (!payload?.role || !['admin', 'barbeiro'].includes(payload.role))
    return json({ success: false, error: 'Acesso negado — role: ' + payload?.role }, 403, cors)

  if (payload.exp && payload.exp * 1000 < Date.now())
    return json({ success: false, error: 'Sessão expirada' }, 401, cors)

  // ── Bindings R2 ───────────────────────────────────────────────────────────
  const bucket     = env.R2 || env.BUCKET
  const publicBase = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

  console.log('[upload-proxy] bucket binding exists:', !!bucket)
  console.log('[upload-proxy] R2_PUBLIC_URL:', publicBase || '(não definido)')

  if (!bucket)
    return json({ success: false, error: 'R2 bucket binding (R2) não configurado no Worker' }, 500, cors)
  if (!publicBase)
    return json({ success: false, error: 'R2_PUBLIC_URL não configurado no Worker' }, 500, cors)

  // ── Parse multipart ───────────────────────────────────────────────────────
  let formData
  try {
    formData = await request.formData()
    console.log('[upload-proxy] formData keys:', [...formData.keys()])
  } catch (e) {
    console.error('[upload-proxy] formData parse error:', e.message)
    return json({ success: false, error: 'Corpo inválido — esperado multipart/form-data: ' + e.message }, 400, cors)
  }

  const file = formData.get('file')
  const key  = formData.get('key')

  console.log('[upload-proxy] key:', key)
  console.log('[upload-proxy] file type:', typeof file, '| mime:', file?.type, '| size:', file?.size)

  if (!file || typeof file === 'string')
    return json({ success: false, error: 'Campo "file" em falta ou inválido' }, 400, cors)
  if (!key || typeof key !== 'string' || key.trim() === '')
    return json({ success: false, error: 'Campo "key" em falta' }, 400, cors)

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowed.includes(file.type)) {
    console.warn('[upload-proxy] tipo não permitido:', file.type)
    return json({ success: false, error: `Tipo de ficheiro não permitido: ${file.type}` }, 400, cors)
  }
  if (file.size > 5 * 1024 * 1024)
    return json({ success: false, error: 'Ficheiro demasiado grande (máx. 5 MB)' }, 400, cors)

  // ── Upload R2 ─────────────────────────────────────────────────────────────
  let buffer
  try {
    buffer = await file.arrayBuffer()
    console.log('[upload-proxy] arrayBuffer size:', buffer.byteLength)
  } catch (e) {
    console.error('[upload-proxy] arrayBuffer error:', e.message)
    return json({ success: false, error: 'Erro ao ler ficheiro: ' + e.message }, 500, cors)
  }

  try {
    if (typeof bucket.put !== 'function') {
      console.error('[upload-proxy] bucket.put não é função. Tipo de bucket:', typeof bucket)
      return json({ success: false, error: 'R2 bucket binding mal configurado (esperado binding R2).' }, 500, cors)
    }
    const putResult = await bucket.put(key.trim(), buffer, {
      httpMetadata: { contentType: file.type },
    })
    console.log('[upload-proxy] R2 put OK | etag:', putResult?.etag)
  } catch (e) {
    console.error('[upload-proxy] R2 bucket.put error:', e?.message ?? String(e))
    return json({
      success: false,
      error:   'Erro ao guardar no R2',
      detail:  e?.message ?? String(e),
    }, 500, cors)
  }

  const publicUrl = `${publicBase}/${key.trim()}`
  console.log('[upload-proxy] success | publicUrl:', publicUrl)

  return json({ success: true, data: { publicUrl } }, 200, cors)
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}
