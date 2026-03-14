/**
 * PUT  /api/admin/unavailabilities/group/:groupId  — editar todos os registos do grupo
 * DELETE /api/admin/unavailabilities/group/:groupId — eliminar todos os registos do grupo
 */
import { authenticateAdmin } from '../../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../../utils/response.js'
import { sanitize } from '../../../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']

export async function onRequest(context) {
  const { request, env, params } = context
  if (request.method === 'OPTIONS') return corsOptions()

  const auth = await authenticateAdmin(request, env)
  if (!auth.success) return unauthorized()

  const groupId = params.groupId
  if (!groupId) return badRequest('Group ID inválido')

  // Verificar que o grupo existe
  const check = await env.DB.prepare(
    'SELECT id FROM horarios_indisponiveis WHERE recurrence_group_id = ? LIMIT 1'
  ).bind(groupId).first()
  if (!check) return notFound('Grupo não encontrado')

  if (request.method === 'DELETE') {
    try {
      await env.DB.prepare(
        'DELETE FROM horarios_indisponiveis WHERE recurrence_group_id = ?'
      ).bind(groupId).run()
      return ok({ message: 'Grupo removido' })
    } catch (e) {
      return serverError('Erro ao remover grupo', e.message)
    }
  }

  if (request.method === 'PUT') {
    try {
      const body = await request.json()
      const { type, reason } = body

      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'

      // Só actualiza tipo e motivo — não mexe nas datas individuais de cada ocorrência
      await env.DB.prepare(
        `UPDATE horarios_indisponiveis
            SET tipo = ?, motivo = ?
          WHERE recurrence_group_id = ?`
      ).bind(tipo, sanitize(reason ?? '', 200), groupId).run()

      return ok({ message: 'Grupo actualizado' })
    } catch (e) {
      return serverError('Erro ao actualizar grupo', e.message)
    }
  }

  return badRequest('Método não suportado')
}
