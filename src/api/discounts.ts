import { api, adminApi } from '@/api/client'
import type { ApiResponse, Discount } from '@/types'

// ─── Público (perfil do cliente) ────────────────────────────────────────────
export const discountsApi = {
    /** Descontos do cliente autenticado */
    myDiscounts: () =>
        api.get<Discount[]>('/api/me/discounts'),
}

// ─── Admin ───────────────────────────────────────────────────────────────────
export const adminDiscountsApi = {
    /** Listar todos os descontos (gerais + por cliente) */
    list: (params?: { client_id?: number; ativo?: 0 | 1 }) => {
        const q = new URLSearchParams()
        if (params?.client_id != null) q.set('client_id', String(params.client_id))
        if (params?.ativo != null)     q.set('ativo', String(params.ativo))
        return adminApi.get<Discount[]>(`/api/admin/discounts?${q.toString()}`)
    },

    /** Descontos de um cliente específico */
    forClient: (clientId: number) =>
        adminApi.get<Discount[]>(`/api/admin/discounts?client_id=${clientId}`),

    /** Descontos aplicáveis a uma reserva (geral + cliente) */
    applicable: (clientId: number) =>
        adminApi.get<Discount[]>(`/api/admin/discounts/applicable?client_id=${clientId}`),

    create: (data: Partial<Discount>) =>
        adminApi.post<Discount>('/api/admin/discounts', data),

    update: (id: number, data: Partial<Discount>) =>
        adminApi.put<Discount>(`/api/admin/discounts/${id}`, data),

    delete: (id: number) =>
        adminApi.delete<void>(`/api/admin/discounts/${id}`),

    /** Marcar desconto como usado numa reserva */
    markUsed: (id: number, reservaId: number, comentario?: string) =>
        adminApi.post<void>(`/api/admin/discounts/${id}/use`, { reserva_id: reservaId, comentario }),
}