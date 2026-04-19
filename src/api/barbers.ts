import { adminApi } from './client'
import type { Barber, Unavailable, ApiResponse } from '@/types'

export const barbersApi = {
  list: (options?: { includeInactive?: boolean }) =>
    adminApi.get<Barber[]>(`/api/admin/barbers${options?.includeInactive ? '?include_inactive=1' : ''}`),
  get: (id: number) => adminApi.get<Barber>(`/api/admin/barbers/${id}`),
  create: (data: Partial<Barber>) => adminApi.post<Barber>('/api/admin/barbers', data),
  update: (id: number, data: Partial<Barber>) =>
    adminApi.put<Barber>(`/api/admin/barbers/${id}`, data),
  delete: (id: number) =>
    adminApi.delete<ApiResponse<null>>(`/api/admin/barbers/${id}`),

  // Indisponibilidades
  listUnavailable: (params?: { barberId?: number; date?: string }) => {
    const qs = new URLSearchParams()
    if (params?.barberId) qs.append('barber_id', String(params.barberId))
    if (params?.date)     qs.append('date', params.date)
    const q = qs.toString()
    return adminApi.get<Unavailable[]>(`/api/admin/unavailabilities${q ? `?${q}` : ''}`)
  },

  createUnavailable: (data: Partial<Unavailable> & {
    cancel_reservation_ids?: number[]
    cancel_reason?: string
    skip_conflict_check?: boolean
  }) => {
    const payload = {
      barber_id:           data.barbeiro_id,
      start:               data.data_hora_inicio,
      end:                 data.data_hora_fim,
      is_all_day:          !!data.is_all_day,
      type:                data.tipo,
      reason:              data.motivo,
      recurrence_type:     data.recurrence_type,
      recurrence_end_date: data.recurrence_end_date,
      cancel_reservation_ids: data.cancel_reservation_ids,
      cancel_reason:          data.cancel_reason,
      skip_conflict_check:    data.skip_conflict_check,
    }
    return adminApi.post<Unavailable>('/api/admin/unavailabilities', payload)
  },

  updateUnavailable: (id: number, data: Partial<Unavailable>) => {
    const payload = {
      barber_id:           data.barbeiro_id,
      start:               data.data_hora_inicio,
      end:                 data.data_hora_fim,
      is_all_day:          data.is_all_day !== undefined ? !!data.is_all_day : undefined,
      type:                data.tipo,
      reason:              data.motivo,
      recurrence_type:     data.recurrence_type,
      recurrence_end_date: data.recurrence_end_date,
    }
    return adminApi.put<Unavailable>(`/api/admin/unavailabilities/${id}`, payload)
  },

  updateGroup: (groupId: string, data: {
    barber_id?: number
    start?: string
    end?: string
    is_all_day?: number
    type?: string
    reason?: string
    recurrence_type?: 'none' | 'daily' | 'weekly'
    recurrence_end_date?: string
  }) =>
    adminApi.put<ApiResponse<null>>(`/api/admin/unavailabilities/group/${groupId}`, data),

  deleteUnavailable: (id: number, options?: { group?: boolean }) => {
    const qs = options?.group ? '?group=1' : ''
    return adminApi.delete<ApiResponse<null>>(`/api/admin/unavailabilities/${id}${qs}`)
  },

  deleteGroup: (groupId: string) =>
    adminApi.delete<ApiResponse<null>>(`/api/admin/unavailabilities/group/${groupId}`),
}
