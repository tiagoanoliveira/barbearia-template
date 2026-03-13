import { api } from './client'
import type { Reservation, ApiResponse, PaginatedResponse } from '@/types'

export interface ReservationsFilter {
  page?: number
  perPage?: number
  status?: string
  barberId?: number
  date?: string
  search?: string
}

export const reservationsApi = {
  list: (filters: ReservationsFilter = {}) => {
    const params = new URLSearchParams()
    if (filters.page)    params.append('offset', String((filters.page - 1) * (filters.perPage ?? 20)))
    if (filters.perPage) params.append('limit',  String(filters.perPage))
    if (filters.status)  params.append('status', filters.status)
    if (filters.date)    params.append('date',   filters.date)
    return api.get<PaginatedResponse<Reservation>>(`/api/admin/reservations?${params}`)
  },

  get: (id: number) =>
    api.get<Reservation>(`/api/admin/reservations/${id}`),

  create: (data: Partial<Reservation>) =>
    api.post<Reservation>('/api/admin/reservations', data),

  // PATCH /api/admin/reservations/:id — body { status, notes, private_note }
  update: (id: number, data: Partial<Reservation>) =>
    api.patch<Reservation>(`/api/admin/reservations/${id}`, data),

  updateStatus: (id: number, status: Reservation['status']) =>
    api.patch<Reservation>(`/api/admin/reservations/${id}`, { status }),

  delete: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/reservations/${id}`),
}
