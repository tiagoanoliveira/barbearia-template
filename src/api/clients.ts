import { api } from './client'
import type { Client, ApiResponse, PaginatedResponse } from '@/types'

export const clientsApi = {
  list: (params?: { page?: number; perPage?: number; search?: string }) => {
    const q = new URLSearchParams()
    if (params?.page) q.append('page', String(params.page))
    if (params?.perPage) q.append('perPage', String(params.perPage))
    if (params?.search) q.append('search', params.search)
    return api.get<PaginatedResponse<Client>>(`/api/admin/clients?${q}`)
  },

  get: (id: number) =>
    api.get<Client>(`/api/admin/clients/${id}`),

  update: (id: number, data: Partial<Client>) =>
    api.put<Client>(`/api/admin/clients/${id}`, data),

  delete: (id: number) =>
    api.delete<ApiResponse<null>>(`/api/admin/clients/${id}`),
}
