import { ok, serverError, corsOptions, notFound } from '../../../utils/response.js'

export async function onRequest(context) {
    const { env, params } = context
    if (context.request.method === 'OPTIONS') return corsOptions()

    const barberId = parseInt(params.id)
    if (isNaN(barberId)) return notFound()

    try {
        // Serviços que este barbeiro FAZ:
        // 1. Serviços sem override → faz todos (preco/duracao base)
        // 2. Serviços com override ativo=1 → faz, com preco/duracao específicos
        // 3. Serviços com override ativo=0 → NÃO faz
        const { results } = await env.DB.prepare(
            `SELECT
         s.id,
         s.nome        AS name,
         s.svg,
         s.abreviacao,
         s.color,
         COALESCE(sb.preco,   s.preco)   AS price,
         COALESCE(sb.duracao, s.duracao) AS duration,
         CASE WHEN sb.barbeiro_id IS NULL THEN 1 ELSE sb.ativo END AS available
       FROM servicos s
       LEFT JOIN servico_barbeiro sb
         ON sb.servico_id = s.id AND sb.barbeiro_id = ?
       ORDER BY s.id`
        ).bind(barberId).all()

        // Filtrar apenas os disponíveis para este barbeiro
        return ok(results.filter(s => s.available === 1))
    } catch (e) {
        return serverError('Erro ao carregar serviços do barbeiro', e.message)
    }
}