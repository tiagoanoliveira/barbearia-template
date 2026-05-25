import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, badRequest, corsOptions } from '../../../utils/response.js'
import { sanitize } from '../../../utils/validators.js'

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)

  if (request.method === 'PUT') {
    const { name, duration, price, svg, abreviacao, color, barber_overrides } = await request.json()
    await env.DB.prepare(
        'UPDATE servicos SET nome = ?, duracao = ?, preco = ?, svg = ?, abreviacao = ?, color = ? WHERE id = ?'
    ).bind(
        sanitize(name, 100), parseInt(duration), parseInt(price),
        svg ?? 'null', sanitize(abreviacao ?? 'null', 10), color ?? '#0f7e44',
        id
    ).run()

    // Actualizar overrides: apagar os existentes e reinserir
    if (Array.isArray(barber_overrides)) {
      await env.DB.prepare('DELETE FROM servico_barbeiro WHERE servico_id = ?').bind(id).run()
      for (const ov of barber_overrides) {
        await env.DB.prepare(
            `INSERT INTO servico_barbeiro (servico_id, barbeiro_id, preco, duracao, ativo)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
            id,
            ov.barbeiro_id,
            ov.preco   != null ? parseInt(ov.preco)   : null,
            ov.duracao != null ? parseInt(ov.duracao) : null,
            ov.ativo !== false ? 1 : 0
        ).run()
      }
    }

    return ok({ message: 'Serviço atualizado' })
  }

  if (request.method === 'DELETE') {
    // ON DELETE CASCADE trata da servico_barbeiro automaticamente
    await env.DB.prepare('DELETE FROM servicos WHERE id = ?').bind(id).run()
    return ok({ message: 'Serviço eliminado' })
  }

  return badRequest('Método não suportado')
}