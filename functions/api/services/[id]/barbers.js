import { ok, serverError, corsOptions, notFound } from '../../../utils/response.js'

export async function onRequest(context) {
    const { env, params } = context
    if (context.request.method === 'OPTIONS') return corsOptions()

    const serviceId = parseInt(params.id)
    if (isNaN(serviceId)) return notFound()

    try {
        // Todos os barbeiros activos + se fazem este serviço + a que preço/duração
        // Regra: se não há override → barbeiro faz o serviço ao preço/duração base
        //        se override ativo=0 → não faz
        //        se override ativo=1 → faz com preco/duracao específicos (ou herda base se NULL)
        const { results } = await env.DB.prepare(
            `SELECT
         b.id,
         b.nome           AS name,
         b.foto,
         b.color,
         COALESCE(sb.preco,   s.preco)   AS price,
         COALESCE(sb.duracao, s.duracao) AS duration,
         CASE WHEN sb.barbeiro_id IS NULL THEN 1 ELSE sb.ativo END AS available
       FROM barbeiros b
       CROSS JOIN servicos s
       LEFT JOIN servico_barbeiro sb
         ON sb.barbeiro_id = b.id AND sb.servico_id = s.id
       WHERE s.id = ?
         AND (b.active IS NULL OR b.active = 1)
       ORDER BY b.nome`
        ).bind(serviceId).all()

        return ok(results.filter(b => b.available === 1))
    } catch (e) {
        return serverError('Erro ao carregar barbeiros do serviço', e.message)
    }
}