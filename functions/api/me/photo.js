/**
 * POST /api/me/photo
 * multipart/form-data: file (File/Blob)
 *
 * Faz upload da foto de perfil do cliente para R2 e guarda
 * o URL público em clientes.foto_perfil.
 */
import { authenticateClient } from '../../utils/auth.js'
import { unauthorized, badRequest, serverError, ok, corsOptions } from '../../utils/response.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()
  if (request.method !== 'POST')    return badRequest('Método não suportado')

  const auth = await authenticateClient(request, env)
  if (!auth.success) return unauthorized()

  const bucket     = env.R2 || env.BUCKET
  const publicBase = (env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

  console.log('[me/photo] bucket binding:', !!bucket, '| publicBase:', publicBase)

  if (!bucket)     return serverError('R2 bucket não configurado (binding R2)')
  if (!publicBase) return serverError('R2_PUBLIC_URL não configurado')

  let formData
  try { formData = await request.formData() }
  catch (e) { return badRequest('Corpo inválido: ' + e.message) }

  const file = formData.get('file')
  if (!file || typeof file === 'string') return badRequest('Campo file em falta')

  const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
  if (!allowed.includes(file.type)) return badRequest(`Tipo não permitido: ${file.type}`)
  if (file.size > 3 * 1024 * 1024)  return badRequest('Ficheiro demasiado grande (máx. 3 MB)')

  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const key = `clientes/${auth.clientId}/foto.${ext}`

  try {
    const buf = await file.arrayBuffer()
    if (typeof bucket.put !== 'function') {
      console.error('[me/photo] bucket.put não é função. Tipo de bucket:', typeof bucket)
      return serverError('R2 bucket binding mal configurado (esperado binding R2).', 'bucket.put not function')
    }
    await bucket.put(key, buf, { httpMetadata: { contentType: file.type } })
  } catch (e) {
    console.error('[me/photo] R2 error:', e.message)
    return serverError('Erro ao guardar foto no R2', e.message)
  }

  const photoUrl = `${publicBase}/${key}`

  await env.DB.prepare(
    'UPDATE clientes SET foto_perfil = ?, atualizado_em = CURRENT_TIMESTAMP WHERE id = ?'
  ).bind(photoUrl, auth.clientId).run()

  return ok({ photo_url: photoUrl })
}
