import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck, ChevronRight, Plus,
  CheckCircle2, XCircle, AlertCircle, Clock,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  format, parseISO, subDays, subWeeks,
  startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths,
} from 'date-fns'
import { pt } from 'date-fns/locale'

import { dashboardApi } from '@/api/dashboard'
import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ROUTES } from '@/config/routes'
import type { StatsComparison } from '@/types'

// ─── Preset de períodos ───────────────────────────────────────────────────────
type Preset = 'week' | 'last2weeks' | 'month' | 'last2months' | 'custom'

function getPeriods(
  preset: Preset,
  customA?: { start: string; end: string },
  customB?: { start: string; end: string },
) {
  const today = new Date()
  const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

  switch (preset) {
    case 'week':
      return {
        A: {
          start: fmt(startOfWeek(today, { weekStartsOn: 1 })),
          end: fmt(endOfWeek(today, { weekStartsOn: 1 })),
        },
        B: {
          start: fmt(startOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })),
          end: fmt(endOfWeek(subWeeks(today, 1), { weekStartsOn: 1 })),
        },
        labelA: 'Semana atual',
        labelB: 'Semana anterior',
      }
    case 'last2weeks':
      return {
        A: { start: fmt(subDays(today, 13)), end: fmt(today) },
        B: { start: fmt(subDays(today, 27)), end: fmt(subDays(today, 14)) },
        labelA: 'Últimos 14 dias',
        labelB: '14 dias anteriores',
      }
    case 'month':
      return {
        A: { start: fmt(startOfMonth(today)), end: fmt(endOfMonth(today)) },
        B: {
          start: fmt(startOfMonth(subMonths(today, 1))),
          end: fmt(endOfMonth(subMonths(today, 1))),
        },
        labelA: 'Este mês',
        labelB: 'Mês anterior',
      }
    case 'last2months':
      return {
        A: { start: fmt(subDays(today, 29)), end: fmt(today) },
        B: { start: fmt(subDays(today, 59)), end: fmt(subDays(today, 30)) },
        labelA: 'Últimos 30 dias',
        labelB: '30 dias anteriores',
      }
    case 'custom':
      return {
        A: customA ?? { start: fmt(subDays(today, 6)), end: fmt(today) },
        B: customB ?? {
          start: fmt(subDays(today, 13)),
          end: fmt(subDays(today, 7)),
        },
        labelA: 'Período A',
        labelB: 'Período B',
      }
  }
}

// ─── Componente de stat do barbeiro hoje ─────────────────────────────────────
function BarberTodayCard({
  barbeiro_nome,
  barbeiro_color,
  confirmadas,
  concluidas,
  canceladas,
  faltas,
}: {
  barbeiro_nome: string
  barbeiro_color: string
  confirmadas: number
  concluidas: number
  canceladas: number
  faltas: number
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ background: barbeiro_color }}
        />
        <span className="text-sm font-semibold text-gray-900 truncate">
          {barbeiro_nome}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5">
          <Clock size={13} className="text-blue-500" />
          <span className="text-xs text-gray-500">Confirmadas</span>
          <span className="ml-auto text-sm font-bold text-gray-800">
            {confirmadas}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={13} className="text-emerald-500" />
          <span className="text-xs text-gray-500">Concluídas</span>
          <span className="ml-auto text-sm font-bold text-gray-800">
            {concluidas}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle size={13} className="text-red-400" />
          <span className="text-xs text-gray-500">Canceladas</span>
          <span className="ml-auto text-sm font-bold text-gray-800">
            {canceladas}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertCircle size={13} className="text-amber-400" />
          <span className="text-xs text-gray-500">Faltas</span>
          <span className="ml-auto text-sm font-bold text-gray-800">
            {faltas}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Preparar dados para o gráfico de comparação ─────────────────────────────
function prepareChartData(
  rows: StatsComparison[],
  labelA: string,
  labelB: string,
) {
  const mapA = new Map<string, StatsComparison>()
  const mapB = new Map<string, StatsComparison>()

  rows.forEach((r) => {
    if (r.periodo === 'A') mapA.set(r.data, r)
    else mapB.set(r.data, r)
  })

  const daysA = [...mapA.values()].sort((a, b) => a.data.localeCompare(b.data))
  const daysB = [...mapB.values()].sort((a, b) => a.data.localeCompare(b.data))
  const len = Math.max(daysA.length, daysB.length)

  return Array.from({ length: len }, (_, i) => ({
    dia: `Dia ${i + 1}`,
    [`${labelA} — Concluídas`]: daysA[i]?.concluidas ?? 0,
    [`${labelB} — Concluídas`]: daysB[i]?.concluidas ?? 0,
  }))
}

// ─── Dashboard principal ──────────────────────────────────────────────────────
export default function DashboardPage() {
  const [preset, setPreset] = useState<Preset>('week')
  const [barbeiro, setBarbeiro] = useState<number | undefined>(undefined)

  const periods = getPeriods(preset)

  const { data: todayRes, isLoading: todayLoading } = useQuery({
    queryKey: ['stats-today'],
    queryFn: () => dashboardApi.todayByBarber(),
    refetchInterval: 60_000,
  })

  const { data: compRes, isLoading: compLoading } = useQuery({
    queryKey: ['stats-comparison', preset, barbeiro],
    queryFn: () =>
      dashboardApi.comparison({
        periodA_start: periods.A.start,
        periodA_end: periods.A.end,
        periodB_start: periods.B.start,
        periodB_end: periods.B.end,
        barbeiro_id: barbeiro,
      }),
  })

  const { data: barbersRes } = useQuery({
    queryKey: ['barbers'],
    queryFn: () => barbersApi.list(),
  })

  const { data: recentRes, isLoading: recentLoading } = useQuery({
    queryKey: ['reservations-recent'],
    queryFn: () => reservationsApi.list({ perPage: 6, page: 1 }),
  })

  const todayStats = todayRes?.data ?? []
  const compRows = compRes?.data ?? []
  const barbers = barbersRes?.data ?? []
  const recent = recentRes?.data?.items ?? []
  const chartData = prepareChartData(compRows, periods.labelA, periods.labelB)
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })

  const PRESETS: { value: Preset; label: string }[] = [
    { value: 'week', label: 'Esta semana vs anterior' },
    { value: 'last2weeks', label: 'Últimos 14 vs 14 anteriores' },
    { value: 'month', label: 'Este mês vs anterior' },
    { value: 'last2months', label: 'Últimos 30 vs 30 anteriores' },
  ]

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 capitalize">{today}</p>
          <h2 className="text-xl font-bold text-gray-900">Bom dia! 👋</h2>
        </div>
        <Link to={ROUTES.ADMIN_RESERVATIONS} className="btn-primary text-sm">
          <Plus size={16} /> Nova reserva
        </Link>
      </div>

      {/* Reservas de hoje por barbeiro */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Hoje por barbeiro
        </h3>
        {todayLoading ? (
          <div className="flex justify-center py-6">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {todayStats.map((bs: any) => (
              <BarberTodayCard key={bs.barbeiro_id} {...bs} />
            ))}
          </div>
        )}
      </div>

      {/* Gráfico de comparação */}
      <Card>
        <CardHeader
          title="Comparação de períodos"
          subtitle="Reservas concluídas — período A vs período B"
        />

        {/* Controlos */}
        <div className="flex flex-wrap gap-3 px-5 pb-4">
          {/* Preset selector */}
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPreset(p.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  preset === p.value
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Filtro barbeiro */}
          <select
            value={barbeiro ?? ''}
            onChange={(e) =>
              setBarbeiro(e.target.value ? Number(e.target.value) : undefined)
            }
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 ml-auto"
          >
            <option value="">Todos os barbeiros</option>
            {barbers.map((b: { id: number; name: string }) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Labels dos períodos */}
        <div className="flex gap-4 px-5 pb-2">
          <span className="text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-brand-500 mr-1" />
            {periods.labelA}: {periods.A.start} → {periods.A.end}
          </span>
          <span className="text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />
            {periods.labelB}: {periods.B.start} → {periods.B.end}
          </span>
        </div>

        {compLoading ? (
          <div className="flex justify-center py-10">
            <LoadingSpinner />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 16, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis
                dataKey="dia"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#f9fafb',
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar
                dataKey={`${periods.labelA} — Concluídas`}
                fill="#d4a017"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey={`${periods.labelB} — Concluídas`}
                fill="#60a5fa"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Reservas recentes */}
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Reservas recentes
            </h3>
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
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recent.map((r: any) => (
              <div
                key={r.id}
                className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center">
                  <span className="text-brand-700 text-xs font-semibold">
                    {r.client_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {r.client_name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.service_name} · {r.barber_name}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-medium text-gray-700">
                    {format(parseISO(r.data_hora), 'd MMM, HH:mm', { locale: pt })}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-8">
                Sem reservas recentes.
              </p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
