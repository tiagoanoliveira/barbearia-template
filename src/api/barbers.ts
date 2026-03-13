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
    const q = barberId ? `?barberId=${barberId}` : ''
    return api.get<Unavailable[]>(`/api/admin/unavailable${q}`)
  },
  createUnavailable: (data: Partial<Unavailable>) =>
    api.post<Unavailable>('/api/admin/unavailable', data),
  updateUnavailable: (id: number, data: Partial<Unavailable>) =>
    api.put<Unavailable>(`/api/admin/unavailable/${id}`, data),
  deleteUnavailable: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/unavailable/${id}`),
}
