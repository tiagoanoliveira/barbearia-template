import { api } from './client'
import type { Client, ApiResponse, PaginatedResponse } from '@/types'

export interface ClientsFilter {
  page?: number
  perPage?: number
  search?: string
}

export const clientsApi = {
  list: (filters: ClientsFilter = {}) => {
    const params = new URLSearchParams()
    if (filters.page)    params.append('offset', String((filters.page - 1) * (filters.perPage ?? 20)))
    if (filters.perPage) params.append('limit',  String(filters.perPage))
    if (filters.search)  params.append('search', filters.search)
    return api.get<PaginatedResponse<Client>>(`/api/admin/clients?${params}`)
  },

  get: (id: number) =>
    api.get<Client>(`/api/admin/clients/${id}`),

  update: (id: number, data: Partial<Client>) =>
    api.patch<Client>(`/api/admin/clients/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/clients/${id}`),
}
