import { adminApi } from './client'
import type { DashboardStats, StatsComparison, TodayBarberStats } from '@/types'

export const dashboardApi = {
  stats: () => adminApi.get<DashboardStats>('/api/admin/dashboard'),

  // Cloudflare Pages Functions: stats-today.js  -> /api/admin/stats-today
  todayByBarber: () =>
    adminApi.get<TodayBarberStats[]>('/api/admin/stats-today'),

  // Cloudflare Pages Functions: stats-comparison.js -> /api/admin/stats-comparison
  comparison: (params: {
    periodA_start: string
    periodA_end:   string
    periodB_start: string
    periodB_end:   string
    barbeiro_id?:  number
  }) => {
    const qs = new URLSearchParams({
      periodA_start: params.periodA_start,
      periodA_end:   params.periodA_end,
      periodB_start: params.periodB_start,
      periodB_end:   params.periodB_end,
      ...(params.barbeiro_id != null ? { barbeiro_id: String(params.barbeiro_id) } : {}),
    }).toString()
    return adminApi.get<StatsComparison[]>(`/api/admin/stats-comparison?${qs}`)
  },
}
