import { adminApi } from './client'
import type { DashboardStats } from '@/types'

export const dashboardApi = {
  stats: () => adminApi.get<DashboardStats>('/api/admin/dashboard'),
}
