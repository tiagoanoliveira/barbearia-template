/**
 * POST /api/admin/upload-proxy
 * multipart/form-data: file (File/Blob) + key (string)
 *
 * Autenticação: Bearer JWT emitido pelo login de admin.
 * Binding obrigatório: R2 (R2 bucket) + R2_PUBLIC_URL.
 */
import { authenticateAdmin } from '../../../utils/auth.js'

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

  // ── Autenticação via BD (role real, não o do JWT payload) ─────────────────
  const auth = await authenticateAdmin(request, env)
  if (!auth.success)
    return json({ success: false, error: 'Token inválido ou sessão expirada' }, 401, cors)

  const allowedRoles = ['admin', 'barbeiro', 'superAdmin']
  if (!allowedRoles.includes(auth.user?.role)) {
    console.warn('[upload-proxy] acesso negado — role:', auth.user?.role)
    return json({ success: false, error: 'Acesso negado — role: ' + auth.user?.role }, 403, cors)
  }

  // ── Bindings R2 ───────────────────────────────────────────────────────────
  const bucket     = env.R2 || env.BUCKET
  const publicBase = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

  if (!bucket)
    return json({ success: false, error: 'R2 bucket binding (R2) não configurado no Worker' }, 500, cors)
  if (!publicBase)
    return json({ success: false, error: 'R2_PUBLIC_URL não configurado no Worker' }, 500, cors)

  // ── Parse multipart ───────────────────────────────────────────────────────
  let formData
  try {
    formData = await request.formData()
  } catch (e) {
    return json({ success: false, error: 'Corpo inválido — esperado multipart/form-data: ' + e.message }, 400, cors)
  }

  const file = formData.get('file')
  const key  = formData.get('key')

  if (!file || typeof file === 'string')
    return json({ success: false, error: 'Campo "file" em falta ou inválido' }, 400, cors)
  if (!key || typeof key !== 'string' || key.trim() === '')
    return json({ success: false, error: 'Campo "key" em falta' }, 400, cors)

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
  if (!allowed.includes(file.type))
    return json({ success: false, error: `Tipo de ficheiro não permitido: ${file.type}` }, 400, cors)
  if (file.size > 5 * 1024 * 1024)
    return json({ success: false, error: 'Ficheiro demasiado grande (máx. 5 MB)' }, 400, cors)

  // ── Upload R2 ─────────────────────────────────────────────────────────────
  let buffer
  try {
    buffer = await file.arrayBuffer()
  } catch (e) {
    return json({ success: false, error: 'Erro ao ler ficheiro: ' + e.message }, 500, cors)
  }

  try {
    if (typeof bucket.put !== 'function')
      return json({ success: false, error: 'R2 bucket binding mal configurado.' }, 500, cors)

    const putResult = await bucket.put(key.trim(), buffer, {
      httpMetadata: { contentType: file.type },
    })
    console.log('[upload-proxy] R2 put OK | etag:', putResult?.etag)
  } catch (e) {
    return json({ success: false, error: 'Erro ao guardar no R2', detail: e?.message ?? String(e) }, 500, cors)
  }

  const publicUrl = `${publicBase}/${key.trim()}`
  return json({ success: true, data: { publicUrl } }, 200, cors)
}

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extra },
  })
}
