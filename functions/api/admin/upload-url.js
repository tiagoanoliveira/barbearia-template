import { authenticateAdmin } from '../../utils/auth.js'
import { ok, badRequest, unauthorized, corsOptions } from '../../utils/response.js'

/**
 * POST /api/admin/upload-url
 * Body: { key: string, contentType: string }
 * Devolve { uploadUrl, publicUrl } para o frontend fazer PUT directo no R2.
 * Exige autenticação admin.
 */
export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method !== 'POST') return badRequest('Método não suportado')

  const { key, contentType } = await request.json().catch(() => ({}))
  if (!key || !contentType) return badRequest('key e contentType são obrigatórios')

  // Valida extensão — só imagens
  const allowed = ['image/jpeg','image/png','image/webp','image/gif','image/svg+xml']
  if (!allowed.includes(contentType)) return badRequest('Tipo de ficheiro não permitido')

  const bucket     = env.R2 || env.BUCKET          // binding R2 (nome do binding, não o nome do bucket)
  const publicBase = env.R2_PUBLIC_URL?.replace(/\/$/, '') // ex: https://pub-xxx.r2.dev

  if (!bucket)     return badRequest('R2 bucket binding (R2) não configurado')
  if (!publicBase) return badRequest('R2_PUBLIC_URL não configurado')

  // Nesta implementação usamos sempre o proxy interno em vez de signed URLs
  const proxyUrl = `${env.BASE_URL?.replace(/\/$/, '') || ''}/api/admin/upload-proxy`

  return ok({
    uploadUrl:  proxyUrl,  // o frontend vai fazer POST aqui com o ficheiro
    publicUrl:  `${publicBase}/${key}`,
    key,
    useProxy:   true,
  })
}
