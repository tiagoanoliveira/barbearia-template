/**
 * PUT  /api/admin/unavailabilities/group/:groupId  — editar todos os registos do grupo
 * DELETE /api/admin/unavailabilities/group/:groupId — eliminar todos os registos do grupo
 */
import { authenticateAdmin } from '../../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../../utils/response.js'
import { sanitize } from '../../../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']
const VALID_RECURRENCE = ['none', 'daily', 'weekly']

function normalizeOccurrence(start, end) {
  return {
    start: String(start).replace('Z', '').split('.')[0],
    end:   String(end).replace('Z', '').split('.')[0],
  }
}

function buildOccurrences({ start, end, recurrenceType, recurrenceEndDate }) {
  if (recurrenceType !== 'none' && recurrenceEndDate) {
    const startDate = new Date(start)
    const endDate = new Date(end ?? start)
    const stopDate = new Date(recurrenceEndDate)
    const diffMs = endDate.getTime() - startDate.getTime()
    const inserts = []
    let cursor = new Date(startDate)

    while (cursor <= stopDate) {
      const recStart = new Date(cursor)
      const recEnd = new Date(cursor.getTime() + diffMs)
      inserts.push(normalizeOccurrence(recStart.toISOString(), recEnd.toISOString()))
      if (recurrenceType === 'daily') cursor.setDate(cursor.getDate() + 1)
      else if (recurrenceType === 'weekly') cursor.setDate(cursor.getDate() + 7)
      else break
      if (inserts.length > 365) break
    }
    return inserts
  }

  return [normalizeOccurrence(start, end ?? start)]
}

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
      const { barber_id, start, end, is_all_day, type, reason, recurrence_type, recurrence_end_date } = body

      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
      const rec = recurrence_type && VALID_RECURRENCE.includes(recurrence_type) ? recurrence_type : 'none'
      if (!start || !end) return badRequest('Datas de início e fim são obrigatórias para editar recorrência.')
      if (new Date(end) <= new Date(start)) return badRequest('Data de fim inválida.')

      const nowIso = new Date().toISOString().replace('Z', '').split('.')[0]
      const groupItems = await env.DB.prepare(
        `SELECT id, barbeiro_id, data_hora_inicio, data_hora_fim
           FROM horarios_indisponiveis
          WHERE recurrence_group_id = ?
          ORDER BY data_hora_inicio ASC`
      ).bind(groupId).all()

      const rows = groupItems?.results ?? []
      if (!rows.length) return notFound('Grupo não encontrado')
      const defaultBarberId = rows[0].barbeiro_id
      const nextBarberId = Number(barber_id ?? defaultBarberId)
      const occurrenceRows = buildOccurrences({
        start,
        end,
        recurrenceType: rec,
        recurrenceEndDate: recurrence_end_date,
      }).filter(o => o.start >= nowIso)

      await env.DB.prepare(
        `DELETE FROM horarios_indisponiveis
          WHERE recurrence_group_id = ?
            AND data_hora_inicio >= ?`
      ).bind(groupId, nowIso).run()

      if (occurrenceRows.length) {
        const stmt = env.DB.prepare(`
          INSERT INTO horarios_indisponiveis
            (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo, recurrence_type, recurrence_end_date, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        await env.DB.batch(
          occurrenceRows.map(({ start: s, end: e }) => stmt.bind(
            nextBarberId,
            s,
            e,
            is_all_day ? 1 : 0,
            tipo,
            sanitize(reason ?? '', 200),
            rec,
            recurrence_end_date ?? null,
            groupId,
          ))
        )
      }

      return ok({
        message: 'Grupo actualizado',
        replaced_future_occurrences: occurrenceRows.length,
      })
    } catch (e) {
      return serverError('Erro ao actualizar grupo', e.message)
    }
  }

  return badRequest('Método não suportado')
}
