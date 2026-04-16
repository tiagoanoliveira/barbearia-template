import { adminApi } from './client'
import type { DashboardStats, StatsComparison, TodayBarberStats } from '@/types'

export const dashboardApi = {
  stats: () => adminApi.get<DashboardStats>('/api/admin/dashboard'),

  todayByBarber: () =>
    adminApi.get<TodayBarberStats[]>('/api/admin/stats/today'),

  comparison: (params: {
    periodA_start: string
    periodA_end:   string
    periodB_start: string
    periodB_end:   string
    barbeiro_id?:  number
  }) => adminApi.get<StatsComparison[]>('/api/admin/stats/comparison', { params }),
}
