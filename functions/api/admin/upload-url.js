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

  const bucket     = env.BUCKET          // binding R2 (nome do binding, não o nome do bucket)
  const publicBase = env.R2_PUBLIC_URL?.replace(/\/$/, '') // ex: https://pub-xxx.r2.dev

  if (!bucket)     return badRequest('R2 bucket binding (BUCKET) não configurado')
  if (!publicBase) return badRequest('R2_PUBLIC_URL não configurado')

  // Gera signed URL com validade de 5 minutos
  const signedUrl = await bucket.createMultipartUpload
    ? null   // R2 bindings não têm createPresignedUrl — usamos a API HTTP
    : null

  // R2 Workers binding não suporta signed URLs directamente.
  // A abordagem correcta para Cloudflare Pages Functions é usar a REST API do R2
  // com um token S3-compatible. Aqui usamos a abordagem alternativa:
  // o backend faz o upload em nome do frontend (streaming).
  //
  // Como alternativa mais simples e sem dependências extras,
  // devolvemos um endpoint interno /api/admin/upload-proxy que o frontend chama.
  const proxyUrl = `${env.BASE_URL?.replace(/\/$/, '')}/api/admin/upload-proxy`

  return ok({
    uploadUrl:  proxyUrl,  // o frontend vai fazer POST aqui com o ficheiro
    publicUrl:  `${publicBase}/${key}`,
    key,
    useProxy:   true,
  })
}
