import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck, Users, TrendingUp,
  Clock, ChevronRight, Plus
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { dashboardApi } from '@/api/dashboard'
import { reservationsApi } from '@/api/reservations'
import { Card, CardHeader } from '@/components/ui/Card'
import StatCard from '@/components/ui/StatCard'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ROUTES } from '@/config/routes'

export default function DashboardPage() {
  const { data: statsRes, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => dashboardApi.stats(),
    refetchInterval: 60_000,
  })

  const { data: recentRes, isLoading: recentLoading } = useQuery({
    queryKey: ['reservations-recent'],
    queryFn: () => reservationsApi.list({ perPage: 6, page: 1 }),
  })

  const stats  = statsRes?.data
  const recent = recentRes?.data?.items ?? []

  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 capitalize">{today}</p>
          <h2 className="text-xl font-bold text-gray-900">Bom dia! 👋</h2>
        </div>
        <Link to={ROUTES.ADMIN_RESERVATIONS} className="btn-primary text-sm">
          <Plus size={16} />
          Nova reserva
        </Link>
      </div>

      {/* Stat Cards */}
      {statsLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner size="lg" /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Reservas hoje"
            value={stats?.today ?? 0}
            icon={CalendarCheck}
            iconColor="bg-brand-500"
          />
          <StatCard
            label="Esta semana"
            value={stats?.week ?? 0}
            icon={Clock}
            iconColor="bg-blue-500"
          />
          <StatCard
            label="Clientes totais"
            value={stats?.total_clients ?? 0}
            icon={Users}
            iconColor="bg-violet-500"
          />
          <StatCard
            label="Notificações"
            value={stats?.unread_notifications ?? 0}
            icon={TrendingUp}
            iconColor="bg-emerald-500"
          />
        </div>
      )}

      {/* Reservas recentes */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Reservas recentes</h3>
            <p className="text-xs text-gray-500">As 6 últimas marcações</p>
          </div>
          <Link
            to={ROUTES.ADMIN_RESERVATIONS}
            className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
          >
            Ver todas <ChevronRight size={14} />
          </Link>
        </div>

        {recentLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((r) => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors">
                <div className="flex-shrink-0 w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                  <span className="text-brand-700 text-xs font-semibold">
                    {r.client_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{r.client_name}</p>
                  <p className="text-xs text-gray-500">{r.service_name} · {r.barber_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-gray-700">
                    {format(parseISO(r.data_hora), "d MMM, HH:mm", { locale: pt })}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">Sem reservas recentes.</p>
            )}
          </div>
        )}
      </Card>

      {/* Gráfico — placeholder até o backend ter endpoint /api/admin/stats/chart */}
      <Card>
        <CardHeader
          title="Reservas nos últimos 30 dias"
          subtitle="Volume diário de marcações"
        />
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={[]} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="brandGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#d4a017" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#d4a017" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: '12px', color: '#f9fafb', fontSize: 12 }}
              formatter={(v) => [v, 'Reservas']}
            />
            <Area type="monotone" dataKey="count" stroke="#d4a017" strokeWidth={2}
                  fill="url(#brandGrad)" dot={false} activeDot={{ r: 5, fill: '#d4a017', strokeWidth: 0 }} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>
    </div>
  )
}
