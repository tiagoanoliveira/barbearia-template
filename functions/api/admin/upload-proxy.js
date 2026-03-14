import { authenticateAdmin } from '../../utils/auth.js'
import { ok, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'

/**
 * POST /api/admin/upload-proxy
 * multipart/form-data com campos: file (Blob), key (string)
 *
 * O backend recebe o ficheiro e faz PUT directo no R2 via Workers binding.
 * Devolve { publicUrl }.
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method !== 'POST') return badRequest('Método não suportado')

  const formData    = await request.formData().catch(() => null)
  if (!formData) return badRequest('Corpo inválido — esperado multipart/form-data')

  const file = formData.get('file')
  const key  = formData.get('key')

  if (!file || typeof key !== 'string') return badRequest('Campos file e key são obrigatórios')
  if (!(file instanceof File) && !(file instanceof Blob)) return badRequest('Campo file inválido')

  const allowed = ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
  if (!allowed.includes(file.type)) return badRequest('Tipo de ficheiro não permitido')
  if (file.size > 5 * 1024 * 1024) return badRequest('Ficheiro demasiado grande (máx. 5 MB)')

  const bucket     = env.BUCKET
  const publicBase = env.R2_PUBLIC_URL?.replace(/\/$/, '')

  if (!bucket)     return badRequest('R2 bucket binding (BUCKET) não configurado')
  if (!publicBase) return badRequest('R2_PUBLIC_URL não configurado')

  try {
    await bucket.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    })
  } catch (e) {
    console.error('R2 upload error:', e)
    return serverError('Erro ao guardar ficheiro no R2')
  }

  return ok({ publicUrl: `${publicBase}/${key}` })
}
