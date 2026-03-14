import { authenticateAdmin } from '../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../utils/response.js'
import { isValidId, sanitize } from '../../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']
const VALID_RECURRENCE = ['none', 'daily', 'weekly']

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const id = parseInt(params.id)
  if (isNaN(id) || id < 1) return badRequest('ID inválido')

  // ── PUT — editar uma indisponibilidade singular ─────────────────────────────
  if (request.method === 'PUT') {
    try {
      const body = await request.json()
      const { barber_id, start, end, is_all_day, type, reason, recurrence_type, recurrence_end_date } = body

      const existing = await env.DB.prepare(
        'SELECT id FROM horarios_indisponiveis WHERE id = ?'
      ).bind(id).first()
      if (!existing) return notFound('Indisponibilidade não encontrada')

      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
      const rec  = recurrence_type && VALID_RECURRENCE.includes(recurrence_type) ? recurrence_type : 'none'

      await env.DB.prepare(`
        UPDATE horarios_indisponiveis
           SET barbeiro_id = COALESCE(?, barbeiro_id),
               data_hora_inicio = COALESCE(?, data_hora_inicio),
               data_hora_fim    = COALESCE(?, data_hora_fim),
               is_all_day       = COALESCE(?, is_all_day),
               tipo             = ?,
               motivo           = ?,
               recurrence_type  = ?,
               recurrence_end_date = COALESCE(?, recurrence_end_date)
         WHERE id = ?`
      ).bind(
        barber_id   ?? null,
        start       ?? null,
        end         ?? null,
        is_all_day !== undefined ? (is_all_day ? 1 : 0) : null,
        tipo,
        sanitize(reason ?? '', 200),
        rec,
        recurrence_end_date ?? null,
        id
      ).run()

      return ok({ message: 'Indisponibilidade actualizada' })
    } catch (e) {
      return serverError('Erro ao actualizar indisponibilidade', e.message)
    }
  }

  // ── DELETE — eliminar apenas este registo ───────────────────────────────────
  if (request.method === 'DELETE') {
    try {
      const url           = new URL(request.url)
      const deleteGroup   = url.searchParams.get('group') === '1'

      if (deleteGroup) {
        // Buscar recurrence_group_id deste registo e apagar todo o grupo
        const row = await env.DB.prepare(
          'SELECT recurrence_group_id FROM horarios_indisponiveis WHERE id = ?'
        ).bind(id).first()

        if (row?.recurrence_group_id) {
          await env.DB.prepare(
            'DELETE FROM horarios_indisponiveis WHERE recurrence_group_id = ?'
          ).bind(row.recurrence_group_id).run()
          return ok({ message: 'Grupo de indisponibilidades removido' })
        }
      }

      await env.DB.prepare('DELETE FROM horarios_indisponiveis WHERE id = ?').bind(id).run()
      return ok({ message: 'Indisponibilidade removida' })
    } catch (e) {
      return serverError('Erro ao remover indisponibilidade', e.message)
    }
  }

  return badRequest('Método não suportado')
}
