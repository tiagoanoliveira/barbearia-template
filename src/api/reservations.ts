import { adminApi } from './client'
import type { Reservation, ApiResponse, PaginatedResponse } from '@/types'

export interface ReservationsFilter {
  page?: number
  perPage?: number
  status?: string
  barberId?: number
  date?: string
  fromDate?: string
  toDate?: string
  search?: string
}

export interface CreateReservationPayload extends Partial<Reservation> {
  /** Novo email a persistir no cliente antes de criar a reserva (fluxo placeholder). */
  update_email?: string
  /** Forçar envio (true) ou supressão (false) de email — sobrepõe o valor do form. */
  send_email?: boolean
}

/** Resposta intermédia: backend pediu confirmação do email antes de criar a reserva. */
export interface RequiresEmailUpdateResponse {
  requiresEmailUpdate: true
}

export const reservationsApi = {
  list: (filters: ReservationsFilter = {}) => {
    const params = new URLSearchParams()
    if (filters.page)     params.append('offset', String((filters.page - 1) * (filters.perPage ?? 20)))
    if (filters.perPage)  params.append('limit',  String(filters.perPage))
    if (filters.status)   params.append('status', filters.status)
    if (filters.date)     params.append('date',   filters.date)
    if (filters.fromDate) params.append('date_from', filters.fromDate)
    if (filters.toDate)   params.append('date_to',   filters.toDate)
    if (filters.barberId) params.append('barber_id', String(filters.barberId))
    if (filters.search)   params.append('search', filters.search)
    return adminApi.get<PaginatedResponse<Reservation>>(`/api/admin/reservations?${params}`)
  },

  get: (id: number) =>
    adminApi.get<Reservation>(`/api/admin/reservations/${id}`),

  /**
   * Cria uma nova reserva.
   *
   * Quando o cliente tem email placeholder e send_email=true, o backend devolve
   * { requiresEmailUpdate: true } (HTTP 200) em vez de criar a reserva.
   * Nesse caso o frontend deve mostrar o modal e reenviar com update_email ou send_email=false.
   *
   * Para forçar a criação sem emails, passe send_email: false.
   * Para atualizar o email do cliente e criar com emails, passe update_email: 'novo@email.com'.
   */
  create: (data: CreateReservationPayload) =>
    adminApi.post<Reservation | RequiresEmailUpdateResponse>('/api/admin/reservations', data),

  // PATCH /api/admin/reservations/:id — body { status, notes, private_note }
  update: (id: number, data: Partial<Reservation>) =>
    adminApi.patch<Reservation>(`/api/admin/reservations/${id}`, data),

  updateStatus: (id: number, status: Reservation['status']) =>
    adminApi.patch<Reservation>(`/api/admin/reservations/${id}`, { status }),

  delete: (id: number) =>
    adminApi.delete<ApiResponse<null>>(`/api/admin/reservations/${id}`),
}
