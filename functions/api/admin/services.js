import { authenticateAdmin } from '../../utils/auth.js'
import { ok, created, badRequest, unauthorized, serverError, corsOptions } from '../../utils/response.js'
import { sanitize } from '../../utils/validators.js'

export async function onRequest(context) {
  const { request, env } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  if (request.method === 'GET') {
    const { results: services } = await env.DB.prepare(
        'SELECT id, nome AS name, duracao AS duration, preco AS price, svg, abreviacao, color, conta_fidelizacao FROM servicos ORDER BY id'
    ).all()

    // Buscar todos os overrides por barbeiro
    const { results: overrides } = await env.DB.prepare(
        `SELECT sb.servico_id, sb.barbeiro_id, b.nome AS barber_name,
              sb.preco, sb.duracao, sb.ativo
       FROM servico_barbeiro sb
       JOIN barbeiros b ON b.id = sb.barbeiro_id
       ORDER BY sb.servico_id, b.nome`
    ).all()

    const overrideMap = {}
    for (const o of overrides) {
      if (!overrideMap[o.servico_id]) overrideMap[o.servico_id] = []
      overrideMap[o.servico_id].push({
        barbeiro_id: o.barbeiro_id,
        barber_name: o.barber_name,
        preco:       o.preco,
        duracao:     o.duracao,
        ativo:       o.ativo === 1,
      })
    }

    return ok(services.map(s => ({
      ...s,
      conta_fidelizacao: s.conta_fidelizacao === 1,
      barber_overrides: overrideMap[s.id] ?? [],
    })))
  }

  if (request.method === 'POST') {
    const { name, duration, price, svg, abreviacao, color, conta_fidelizacao, barber_overrides } = await request.json()
    if (!name || !duration || price == null) return badRequest('Nome, duração e preço são obrigatórios')

    const r = await env.DB.prepare(
        'INSERT INTO servicos (nome, duracao, preco, svg, abreviacao, color, conta_fidelizacao) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(
        sanitize(name, 100), parseInt(duration), parseInt(price),
        svg ?? 'null', sanitize(abreviacao ?? 'null', 10), color ?? '#0f7e44',
        conta_fidelizacao === false ? 0 : 1
    ).run()

    const serviceId = r.meta.last_row_id

    // Guardar overrides por barbeiro (se fornecidos)
    if (Array.isArray(barber_overrides) && barber_overrides.length > 0) {
      for (const ov of barber_overrides) {
        await env.DB.prepare(
            `INSERT OR REPLACE INTO servico_barbeiro (servico_id, barbeiro_id, preco, duracao, ativo)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(
            serviceId,
            ov.barbeiro_id,
            ov.preco   != null ? parseInt(ov.preco)   : null,
            ov.duracao != null ? parseInt(ov.duracao) : null,
            ov.ativo !== false ? 1 : 0
        ).run()
      }
    }

    return created({ id: serviceId })
  }

  return badRequest('Método não suportado')
}
