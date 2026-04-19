/**
 * PUT  /api/admin/unavailabilities/group/:groupId  — editar todos os registos do grupo
 * DELETE /api/admin/unavailabilities/group/:groupId — eliminar todos os registos do grupo
 */
import { authenticateAdmin } from '../../../../utils/auth.js'
import { ok, unauthorized, notFound, badRequest, serverError, corsOptions } from '../../../../utils/response.js'
import { sanitize } from '../../../../utils/validators.js'

const VALID_TYPES = ['folga', 'almoco', 'ferias', 'ausencia', 'outro']
const VALID_RECURRENCE_TYPES = ['none', 'daily', 'weekly']

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
      const {
        barber_id,
        start,
        end,
        is_all_day,
        type,
        reason,
        recurrence_type,
        recurrence_end_date,
      } = body

      const meta = await env.DB.prepare(
        `SELECT
           barbeiro_id,
           data_hora_inicio,
           data_hora_fim,
           is_all_day,
           recurrence_type,
           recurrence_end_date
         FROM horarios_indisponiveis
         WHERE recurrence_group_id = ?
         ORDER BY data_hora_inicio ASC
         LIMIT 1`
      ).bind(groupId).first()
      if (!meta) return notFound('Grupo não encontrado')

      const effectiveBarberId = Number(barber_id ?? meta.barbeiro_id)
      const effectiveStart = start ?? meta.data_hora_inicio
      const effectiveEnd = end ?? meta.data_hora_fim
      let effectiveRecurrenceType = 'weekly'
      if (recurrence_type && VALID_RECURRENCE_TYPES.includes(recurrence_type)) {
        effectiveRecurrenceType = recurrence_type
      } else if (meta.recurrence_type && VALID_RECURRENCE_TYPES.includes(meta.recurrence_type)) {
        effectiveRecurrenceType = meta.recurrence_type
      }
      const effectiveRecurrenceEndDate = recurrence_end_date ?? meta.recurrence_end_date ?? null
      const effectiveIsAllDay = is_all_day !== undefined ? (is_all_day ? 1 : 0) : (meta.is_all_day ? 1 : 0)
      const tipo = type && VALID_TYPES.includes(type) ? type : 'folga'
      const motivo = sanitize(reason ?? '', 200)

      if (!effectiveStart) return badRequest('Data de início obrigatória')
      if (!effectiveEnd) return badRequest('Data de fim obrigatória')
      const startTime = new Date(effectiveStart).getTime()
      const endTime = new Date(effectiveEnd).getTime()
      if (endTime <= startTime) {
        return badRequest('Fim deve ser posterior ao início')
      }
      if (effectiveRecurrenceType !== 'none' && !effectiveRecurrenceEndDate) {
        return badRequest('Data final da recorrência obrigatória')
      }

      const occurrences = buildOccurrences({
        start: effectiveStart,
        end: effectiveEnd,
        recurrenceType: effectiveRecurrenceType,
        recurrenceEndDate: effectiveRecurrenceEndDate,
      })
      const nowIso = new Date().toISOString().replace('Z', '').split('.')[0]
      const futureOccurrences = occurrences.filter(o => o.start >= nowIso)

      await env.DB.prepare(
        `DELETE FROM horarios_indisponiveis
          WHERE recurrence_group_id = ?
            AND data_hora_inicio >= ?`
      ).bind(groupId, nowIso).run()

      if (futureOccurrences.length) {
        const insertStmt = env.DB.prepare(`
          INSERT INTO horarios_indisponiveis
            (barbeiro_id, data_hora_inicio, data_hora_fim, is_all_day, tipo, motivo,
             recurrence_type, recurrence_end_date, recurrence_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        await env.DB.batch(
          futureOccurrences.map(({ start: s, end: e }) =>
            insertStmt.bind(
              effectiveBarberId,
              s,
              e,
              effectiveIsAllDay,
              tipo,
              motivo,
              effectiveRecurrenceType,
              effectiveRecurrenceEndDate,
              groupId,
            )
          )
        )
      }

      return ok({ message: 'Grupo actualizado', updated_future_occurrences: futureOccurrences.length })
    } catch (e) {
      return serverError('Erro ao actualizar grupo', e.message)
    }
  }

  return badRequest('Método não suportado')
}
