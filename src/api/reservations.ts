import { api } from './client'
import type { Reservation, ApiResponse, PaginatedResponse } from '@/types'

export interface ReservationsFilter {
  page?: number
  perPage?: number
  status?: string
  barberId?: number
  startDate?: string
  endDate?: string
  search?: string
}

export const reservationsApi = {
  list: (filters: ReservationsFilter = {}) => {
    const params = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== '') params.append(k, String(v))
    })
    return api.get<PaginatedResponse<Reservation>>(
      `/api/admin/reservations?${params}`
    )
  },

  get: (id: number) =>
    api.get<Reservation>(`/api/admin/reservations/${id}`),

  create: (data: Partial<Reservation>) =>
    api.post<Reservation>('/api/admin/reservations', data),

  update: (id: number, data: Partial<Reservation>) =>
    api.put<Reservation>(`/api/admin/reservations/${id}`, data),

  updateStatus: (id: number, status: Reservation['status']) =>
    api.patch<Reservation>(`/api/admin/reservations/${id}/status`, { status }),

  delete: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/reservations/${id}`),
}
