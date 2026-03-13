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
  listUnavailable: (barberId?: number) => {
    const params = new URLSearchParams()
    if (barberId) params.append('barber_id', String(barberId))
    const qs = params.toString()
    return api.get<Unavailable[]>(`/api/admin/unavailabilities${qs ? `?${qs}` : ''}`)
  },
  createUnavailable: (data: Partial<Unavailable>) => {
    const payload = {
      barber_id:        data.barbeiro_id,
      start:            data.data_hora_inicio,
      end:              data.data_hora_fim,
      is_all_day:       !!data.is_all_day,
      type:             data.tipo,
      reason:           data.motivo,
      recurrence_type:  data.recurrence_type,
      recurrence_end_date: data.recurrence_end_date,
    }
    return api.post<Unavailable>('/api/admin/unavailabilities', payload)
  },
  updateUnavailable: (id: number, data: Partial<Unavailable>) => {
    const payload = {
      barber_id:        data.barbeiro_id,
      start:            data.data_hora_inicio,
      end:              data.data_hora_fim,
      is_all_day:       !!data.is_all_day,
      type:             data.tipo,
      reason:           data.motivo,
      recurrence_type:  data.recurrence_type,
      recurrence_end_date: data.recurrence_end_date,
    }
    return api.put<Unavailable>(`/api/admin/unavailabilities/${id}`, payload)
  },
  deleteUnavailable: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/unavailabilities/${id}`),
}
