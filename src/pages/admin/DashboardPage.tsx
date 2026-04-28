import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CalendarCheck, ChevronRight, Plus,
  CheckCircle2, XCircle, AlertCircle, Clock,
  BarChart3,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'
import {
  format,
  parseISO,
  subDays,
  subWeeks,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subMonths,
  eachDayOfInterval,
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
import { useAdminUser } from '@/hooks/useAdminUser'

type RangePreset = 'week' | 'lastWeek' | 'month' | 'lastMonth' | 'last14' | 'custom'

type PeriodRange = { start: string; end: string }

type ComparisonForm = {
  periodAType: RangePreset
  periodBType: RangePreset
  periodAStart: string
  periodAEnd: string
  periodBStart: string
  periodBEnd: string
  barberId?: number
}

const STATUS_CARDS = [
  { key: 'concluidas', label: 'Concluídas', icon: CheckCircle2, color: 'text-emerald-600 border-emerald-200', deltaColor: 'text-emerald-600' },
  { key: 'confirmadas', label: 'Confirmadas', icon: Clock, color: 'text-blue-600 border-blue-200', deltaColor: 'text-blue-600' },
  { key: 'canceladas', label: 'Canceladas', icon: XCircle, color: 'text-red-600 border-red-200', deltaColor: 'text-red-600' },
  { key: 'faltas', label: 'Faltas', icon: AlertCircle, color: 'text-amber-600 border-amber-200', deltaColor: 'text-amber-600' },
] as const

function toIsoDate(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

function clampRange(range: PeriodRange): PeriodRange {
  if (!range.start || !range.end) return range
  if (range.end < range.start) return { start: range.end, end: range.start }
  return range
}

function resolvePresetRange(preset: RangePreset, customStart?: string, customEnd?: string): PeriodRange {
  const today = new Date()

  switch (preset) {
    case 'week':
      return {
        start: toIsoDate(startOfWeek(today, { weekStartsOn: 1 })),
        end: toIsoDate(endOfWeek(today, { weekStartsOn: 1 })),
      }
    case 'lastWeek': {
      const lastWeek = subWeeks(today, 1)
      return {
        start: toIsoDate(startOfWeek(lastWeek, { weekStartsOn: 1 })),
        end: toIsoDate(endOfWeek(lastWeek, { weekStartsOn: 1 })),
      }
    }
    case 'month':
      return {
        start: toIsoDate(startOfMonth(today)),
        end: toIsoDate(endOfMonth(today)),
      }
    case 'lastMonth': {
      const lastMonth = subMonths(today, 1)
      return {
        start: toIsoDate(startOfMonth(lastMonth)),
        end: toIsoDate(endOfMonth(lastMonth)),
      }
    }
    case 'last14':
      return {
        start: toIsoDate(subDays(today, 13)),
        end: toIsoDate(today),
      }
    case 'custom':
      return clampRange({
        start: customStart || toIsoDate(subDays(today, 6)),
        end: customEnd || toIsoDate(today),
      })
  }
}

function formatPeriodLabel(type: RangePreset) {
  switch (type) {
    case 'week': return 'Esta semana'
    case 'lastWeek': return 'Semana anterior'
    case 'month': return 'Este mês'
    case 'lastMonth': return 'Mês anterior'
    case 'last14': return 'Últimos 14 dias'
    case 'custom': return 'Personalizado'
  }
}

function dateListFromRange(range: PeriodRange) {
  const safe = clampRange(range)
  return eachDayOfInterval({
    start: parseISO(safe.start),
    end: parseISO(safe.end),
  }).map(d => format(d, 'yyyy-MM-dd'))
}

function prepareComparison(rows: StatsComparison[], periodA: PeriodRange, periodB: PeriodRange) {
  const mapA = new Map<string, StatsComparison>()
  const mapB = new Map<string, StatsComparison>()

  rows.forEach((r) => {
    if (r.periodo === 'A') mapA.set(r.data, r)
    if (r.periodo === 'B') mapB.set(r.data, r)
  })

  const aDays = dateListFromRange(periodA)
  const bDays = dateListFromRange(periodB)
  const len = Math.max(aDays.length, bDays.length)

  const chartData = Array.from({ length: len }, (_, i) => {
    const dayA = aDays[i]
    const dayB = bDays[i]
    const rowA = dayA ? mapA.get(dayA) : undefined
    const rowB = dayB ? mapB.get(dayB) : undefined

    return {
      x: `${dayA ? format(parseISO(dayA), 'dd/MM') : '—'} | ${dayB ? format(parseISO(dayB), 'dd/MM') : '—'}`,
      periodoAData: dayA,
      periodoBData: dayB,
      periodoAConcluidas: rowA?.concluidas ?? 0,
      periodoBConcluidas: rowB?.concluidas ?? 0,
      periodoATotal: (rowA?.confirmadas ?? 0) + (rowA?.concluidas ?? 0) + (rowA?.canceladas ?? 0) + (rowA?.faltas ?? 0),
      periodoBTotal: (rowB?.confirmadas ?? 0) + (rowB?.concluidas ?? 0) + (rowB?.canceladas ?? 0) + (rowB?.faltas ?? 0),
    }
  })

  const totalsA = { confirmadas: 0, concluidas: 0, canceladas: 0, faltas: 0 }
  const totalsB = { confirmadas: 0, concluidas: 0, canceladas: 0, faltas: 0 }

  aDays.forEach(day => {
    const row = mapA.get(day)
    totalsA.confirmadas += row?.confirmadas ?? 0
    totalsA.concluidas  += row?.concluidas  ?? 0
    totalsA.canceladas  += row?.canceladas  ?? 0
    totalsA.faltas      += row?.faltas      ?? 0
  })

  bDays.forEach(day => {
    const row = mapB.get(day)
    totalsB.confirmadas += row?.confirmadas ?? 0
    totalsB.concluidas  += row?.concluidas  ?? 0
    totalsB.canceladas  += row?.canceladas  ?? 0
    totalsB.faltas      += row?.faltas      ?? 0
  })

  return { chartData, totalsA, totalsB }
}

export default function DashboardPage() {
  const adminUser = useAdminUser()
  const isBarber = adminUser?.role === 'barbeiro'
  const loggedBarberId = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : undefined

  const [form, setForm] = useState<ComparisonForm>(() => {
    const defaultA = resolvePresetRange('month')
    const defaultB = resolvePresetRange('lastMonth')
    return {
      periodAType: 'month',
      periodBType: 'lastMonth',
      periodAStart: defaultA.start,
      periodAEnd: defaultA.end,
      periodBStart: defaultB.start,
      periodBEnd: defaultB.end,
      barberId: loggedBarberId,
    }
  })

  const [applied, setApplied] = useState<ComparisonForm>(form)

  const periodA = useMemo(
    () => resolvePresetRange(applied.periodAType, applied.periodAStart, applied.periodAEnd),
    [applied.periodAType, applied.periodAStart, applied.periodAEnd],
  )
  const periodB = useMemo(
    () => resolvePresetRange(applied.periodBType, applied.periodBStart, applied.periodBEnd),
    [applied.periodBType, applied.periodBStart, applied.periodBEnd],
  )

  const effectiveBarberId = loggedBarberId ?? applied.barberId

  const { data: todayRes, isLoading: todayLoading } = useQuery({
    queryKey: ['stats-today', effectiveBarberId],
    queryFn: () => dashboardApi.todayByBarber(effectiveBarberId),
    refetchInterval: 60_000,
  })

  const { data: compRes, isLoading: compLoading } = useQuery({
    queryKey: ['stats-comparison', periodA.start, periodA.end, periodB.start, periodB.end, effectiveBarberId],
    queryFn: () =>
      dashboardApi.comparison({
        periodA_start: periodA.start,
        periodA_end: periodA.end,
        periodB_start: periodB.start,
        periodB_end: periodB.end,
        barbeiro_id: effectiveBarberId,
      }),
  })

  const { data: barbersRes } = useQuery({
    queryKey: ['barbers'],
    queryFn: () => barbersApi.list(),
  })

  const { data: recentRes, isLoading: recentLoading } = useQuery({
    queryKey: ['reservations-recent', effectiveBarberId],
    queryFn: () => reservationsApi.list({ perPage: 6, page: 1, barberId: effectiveBarberId }),
  })

  const todayStats: any[] = todayRes?.data ?? []
  const compRows = compRes?.data ?? []
  const barbers = barbersRes?.data ?? []
  const recent = recentRes?.data?.items ?? []
  const { chartData, totalsA, totalsB } = prepareComparison(compRows, periodA, periodB)
  const today = format(new Date(), "EEEE, d 'de' MMMM", { locale: pt })

  // Totais do dia (soma de todos os barbeiros)
  const todayTotals = useMemo(() => {
    return todayStats.reduce(
      (acc: { confirmadas: number; concluidas: number; canceladas: number; faltas: number }, bs: any) => ({
        confirmadas: acc.confirmadas + (bs.confirmadas ?? 0),
        concluidas:  acc.concluidas  + (bs.concluidas  ?? 0),
        canceladas:  acc.canceladas  + (bs.canceladas  ?? 0),
        faltas:      acc.faltas      + (bs.faltas      ?? 0),
      }),
      { confirmadas: 0, concluidas: 0, canceladas: 0, faltas: 0 }
    )
  }, [todayStats])

  const presetOptions: { value: RangePreset; label: string }[] = [
    { value: 'week', label: 'Esta semana' },
    { value: 'lastWeek', label: 'Semana anterior' },
    { value: 'month', label: 'Este mês' },
    { value: 'lastMonth', label: 'Mês anterior' },
    { value: 'last14', label: 'Últimos 14 dias' },
    { value: 'custom', label: 'Personalizado' },
  ]

  const updatePeriodType = (period: 'A' | 'B', type: RangePreset) => {
    const next = resolvePresetRange(type)
    setForm(prev =>
      period === 'A'
        ? { ...prev, periodAType: type, periodAStart: next.start, periodAEnd: next.end }
        : { ...prev, periodBType: type, periodBStart: next.start, periodBEnd: next.end },
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500 capitalize">{today}</p>
          <h2 className="text-xl font-bold text-gray-900">Bom dia! 👋</h2>
        </div>
        <Link to={ROUTES.ADMIN_RESERVATIONS} className="btn-primary text-sm">
          <Plus size={16} /> Nova reserva
        </Link>
      </div>

      {/* ── Totais gerais de hoje ── */}
      {!todayLoading && todayStats.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Resumo de hoje</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-blue-100 p-4 shadow-sm flex items-center gap-3">
              <Clock size={20} className="text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Confirmadas</p>
                <p className="text-2xl font-bold text-gray-900">{todayTotals.confirmadas}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-emerald-100 p-4 shadow-sm flex items-center gap-3">
              <CheckCircle2 size={20} className="text-emerald-500 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Concluídas</p>
                <p className="text-2xl font-bold text-gray-900">{todayTotals.concluidas}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-red-100 p-4 shadow-sm flex items-center gap-3">
              <XCircle size={20} className="text-red-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Canceladas</p>
                <p className="text-2xl font-bold text-gray-900">{todayTotals.canceladas}</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-amber-100 p-4 shadow-sm flex items-center gap-3">
              <AlertCircle size={20} className="text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Faltas</p>
                <p className="text-2xl font-bold text-gray-900">{todayTotals.faltas}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Detalhes por barbeiro ── */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Hoje por barbeiro</h3>
        {todayLoading ? (
          <div className="flex justify-center py-6"><LoadingSpinner /></div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {todayStats.map((bs: any) => (
              <div key={bs.barbeiro_id} className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: bs.barbeiro_color }} />
                  <span className="text-sm font-semibold text-gray-900 truncate">{bs.barbeiro_nome}</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5">
                    <Clock size={13} className="text-blue-500" />
                    <span className="text-xs text-gray-500">Confirmadas</span>
                    <span className="ml-auto text-sm font-bold text-gray-800">{bs.confirmadas}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    <span className="text-xs text-gray-500">Concluídas</span>
                    <span className="ml-auto text-sm font-bold text-gray-800">{bs.concluidas}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <XCircle size={13} className="text-red-400" />
                    <span className="text-xs text-gray-500">Canceladas</span>
                    <span className="ml-auto text-sm font-bold text-gray-800">{bs.canceladas}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <AlertCircle size={13} className="text-amber-400" />
                    <span className="text-xs text-gray-500">Faltas</span>
                    <span className="ml-auto text-sm font-bold text-gray-800">{bs.faltas}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardHeader
          title="Comparar períodos"
          subtitle="Analisa reservas por estado entre dois períodos"
        />

        <div className="px-5 pb-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3 grid gap-3">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label text-xs">Período A</label>
                <select
                  className="input text-sm w-full"
                  value={form.periodAType}
                  onChange={e => updatePeriodType('A', e.target.value as RangePreset)}
                >
                  {presetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">De</label>
                <input
                  type="date"
                  className="input text-sm w-full"
                  value={form.periodAStart}
                  onChange={e => setForm(prev => ({ ...prev, periodAType: 'custom', periodAStart: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">Até</label>
                <input
                  type="date"
                  className="input text-sm w-full"
                  value={form.periodAEnd}
                  onChange={e => setForm(prev => ({ ...prev, periodAType: 'custom', periodAEnd: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">Barbeiro</label>
                <select
                  className="input text-sm w-full"
                  value={loggedBarberId ?? form.barberId ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, barberId: e.target.value ? Number(e.target.value) : undefined }))}
                  disabled={!!loggedBarberId}
                >
                  {!loggedBarberId && <option value="">Todos</option>}
                  {barbers.map((b: { id: number; name: string }) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-end">
              <div>
                <label className="label text-xs">Período B</label>
                <select
                  className="input text-sm w-full"
                  value={form.periodBType}
                  onChange={e => updatePeriodType('B', e.target.value as RangePreset)}
                >
                  {presetOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="label text-xs">De</label>
                <input
                  type="date"
                  className="input text-sm w-full"
                  value={form.periodBStart}
                  onChange={e => setForm(prev => ({ ...prev, periodBType: 'custom', periodBStart: e.target.value }))}
                />
              </div>
              <div>
                <label className="label text-xs">Até</label>
                <input
                  type="date"
                  className="input text-sm w-full"
                  value={form.periodBEnd}
                  onChange={e => setForm(prev => ({ ...prev, periodBType: 'custom', periodBEnd: e.target.value }))}
                />
              </div>
              <button className="btn-primary h-10" onClick={() => setApplied(form)}>
                <BarChart3 size={14} /> Comparar
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 px-5 pb-4">
          {STATUS_CARDS.map(({ key, label, icon: Icon, color, deltaColor }) => {
            const aVal = totalsA[key]
            const bVal = totalsB[key]
            const delta = aVal - bVal
            return (
              <div key={key} className={`rounded-xl border bg-white p-3 ${color}`}>
                <p className="text-sm font-semibold flex items-center gap-1.5"><Icon size={14} /> {label}</p>
                <div className="mt-2 flex items-end justify-between">
                  <div>
                    <p className="text-xl font-bold text-gray-900">{aVal}</p>
                    <p className="text-[11px] text-gray-500">{formatPeriodLabel(applied.periodAType)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-gray-700">{bVal}</p>
                    <p className="text-[11px] text-gray-500">{formatPeriodLabel(applied.periodBType)}</p>
                  </div>
                </div>
                <p className={`mt-1 text-xs font-semibold ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta}</p>
              </div>
            )
          })}
        </div>

        <div className="px-5 pb-3 text-xs text-gray-500 flex flex-wrap gap-3">
          <span>{formatPeriodLabel(applied.periodAType)}: {periodA.start} → {periodA.end}</span>
          <span>{formatPeriodLabel(applied.periodBType)}: {periodB.start} → {periodB.end}</span>
        </div>

        {compLoading ? (
          <div className="flex justify-center py-10"><LoadingSpinner /></div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 16, left: -20, bottom: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="x" tick={{ fontSize: 10, fill: '#9ca3af' }} angle={-35} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: '#1f2937',
                  border: 'none',
                  borderRadius: '12px',
                  color: '#f9fafb',
                  fontSize: 12,
                }}
                formatter={(value: number) => [value, 'Reservas concluídas']}
                labelFormatter={(_, payload) => {
                  const row = payload?.[0]?.payload
                  if (!row) return ''
                  return `A: ${row.periodoAData ?? '—'} | B: ${row.periodoBData ?? '—'}`
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="periodoAConcluidas" name={formatPeriodLabel(applied.periodAType)} fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="periodoBConcluidas" name={formatPeriodLabel(applied.periodBType)} fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

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
                  <p className="text-sm font-medium text-gray-900 truncate">{r.client_name}</p>
                  <p className="text-xs text-gray-500">{r.service_name} · {r.barber_name}</p>
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
              <p className="text-center text-sm text-gray-500 py-8">Sem reservas recentes.</p>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
