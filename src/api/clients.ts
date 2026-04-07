import { adminApi } from './client'
import type { Client, ApiResponse, PaginatedResponse } from '@/types'

export interface ClientsFilter {
  page?: number
  perPage?: number
  search?: string
}

export const clientsApi = {
  list: (filters: ClientsFilter = {}) => {
    const params = new URLSearchParams()
    if (filters.page)    params.append('page',    String(filters.page))
    if (filters.perPage) params.append('perPage', String(filters.perPage))
    if (filters.search)  params.append('search',  filters.search)
    return adminApi.get<PaginatedResponse<Client>>(`/api/admin/clients?${params}`)
  },

  get: (id: number) =>
    adminApi.get<Client>(`/api/admin/clients/${id}`),

  create: (data: { name: string; email?: string; phone?: string }) =>
    adminApi.post<Client>('/api/admin/clients', data),

  update: (id: number, data: Partial<Client>) =>
    adminApi.patch<Client>(`/api/admin/clients/${id}`, data),

  delete: (id: number) =>
    adminApi.delete<ApiResponse<null>>(`/api/admin/clients/${id}`),
}
