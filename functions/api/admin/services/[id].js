import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)

  if (request.method === 'PUT') {
    const { name, duration, price, svg, abreviacao, color } = await request.json()
    await env.DB.prepare(
      'UPDATE servicos SET nome = ?, duracao = ?, preco = ?, svg = ?, abreviacao = ?, color = ? WHERE id = ?'
    ).bind(
      sanitize(name, 100), parseInt(duration), parseInt(price),
      svg ?? 'null', sanitize(abreviacao ?? 'null', 10), color ?? '#0f7e44',
      id
    ).run()
    return ok({ message: 'Serviço atualizado' })
  }

  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM servicos WHERE id = ?').bind(id).run()
    return ok({ message: 'Serviço eliminado' })
  }

  return badRequest('Método não suportado')
}
