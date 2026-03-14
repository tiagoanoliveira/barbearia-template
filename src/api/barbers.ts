import { api } from './client'
import type { Barber, Unavailable, ApiResponse } from '@/types'

export const barbersApi = {
  list: () => api.get<Barber[]>('/api/admin/barbers'),
  get: (id: number) => api.get<Barber>(`/api/admin/barbers/${id}`),
  create: (data: Partial<Barber>) => api.post<Barber>('/api/admin/barbers', data),
  update: (id: number, data: Partial<Barber>) =>
    api.put<Barber>(`/api/admin/barbers/${id}`, data),
  delete: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/barbers/${id}`),

  // Indisponibilidades
  listUnavailable: (params?: { barberId?: number; date?: string }) => {
    const qs = new URLSearchParams()
    if (params?.barberId) qs.append('barber_id', String(params.barberId))
    if (params?.date)     qs.append('date', params.date)
    const q = qs.toString()
    return api.get<Unavailable[]>(`/api/admin/unavailabilities${q ? `?${q}` : ''}`)
  },

  createUnavailable: (data: Partial<Unavailable>) => {
    const payload = {
      barber_id:           data.barbeiro_id,
      start:               data.data_hora_inicio,
      end:                 data.data_hora_fim,
      is_all_day:          !!data.is_all_day,
      type:                data.tipo,
      reason:              data.motivo,
      recurrence_type:     data.recurrence_type,
      recurrence_end_date: data.recurrence_end_date,
    }
    return api.post<Unavailable>('/api/admin/unavailabilities', payload)
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
    return api.put<Unavailable>(`/api/admin/unavailabilities/${id}`, payload)
  },

  updateGroup: (groupId: string, data: { type?: string; reason?: string }) =>
    api.put<ApiResponse<null>>(`/api/admin/unavailabilities/group/${groupId}`, data),

  deleteUnavailable: (id: number, options?: { group?: boolean }) => {
    const qs = options?.group ? '?group=1' : ''
    return api.delete<ApiResponse<null>>(`/api/admin/unavailabilities/${id}${qs}`)
  },

  deleteGroup: (groupId: string) =>
    api.delete<ApiResponse<null>>(`/api/admin/unavailabilities/group/${groupId}`),
}
