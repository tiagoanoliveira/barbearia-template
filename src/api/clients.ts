import { adminApi } from './client'
import type { Client, ApiResponse, PaginatedResponse } from '@/types'

export interface ClientUpdatePayload {
  name?: string
  email?: string
  phone?: string
  nif?: number | ''
  notes?: string | null        // null é válido para limpar o campo
  reservas_concluidas?: number
  reservas_gratuitas_disponiveis?: number
  blocked?: boolean
  blocked_reason?: string | null
}

export interface ClientsFilter {
  page?: number
  perPage?: number
  search?: string
  blocked?: 0 | 1              // 0 = só ativos, 1 = só bloqueados, ausente = todos
}

export const clientsApi = {
  list: (filters: ClientsFilter = {}) => {
    const params = new URLSearchParams()
    if (filters.page)             params.append('page',    String(filters.page))
    if (filters.perPage)          params.append('perPage', String(filters.perPage))
    if (filters.search)           params.append('search',  filters.search)
    if (filters.blocked != null)  params.append('blocked', String(filters.blocked))
    return adminApi.get<PaginatedResponse<Client>>(`/api/admin/clients?${params}`)
  },

  get: (id: number) =>
    adminApi.get<Client>(`/api/admin/clients/${id}`),

  create: (data: { name: string; email?: string; phone?: string }) =>
    adminApi.post<Client>('/api/admin/clients', data),

  update: (id: number, data: ClientUpdatePayload) =>
    adminApi.patch<Client>(`/api/admin/clients/${id}`, data),

  delete: (id: number) =>
    adminApi.delete<ApiResponse<null>>(`/api/admin/clients/${id}`),
}
