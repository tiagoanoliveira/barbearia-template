import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { adminApi } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import {
  ReservationDetailModal,
  ReservationEditModal,
  ReservationStatusModal,
} from '@/components/admin/reservation-modals'
import type { Reservation, Barber, Unavailable, UnavailableTipo, Service } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'
import { NewReservationForm, ReservationCopyContent } from '@/components/admin/calendar/forms'
import { UnavailableEditorForm } from '@/components/admin/unavailable/UnavailableEditorForm'
import { UnavailabilityConflictsModal, type UnavailabilityConflictReservation } from '@/components/admin/unavailable/unavailability-modals'

// ─── Horário dinâmico a partir do theme.ts ───────────────────────────────────
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const
type DayKey = typeof DAY_KEYS[number]

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function getDayConfig(date: Date) {
  const key = DAY_KEYS[date.getDay()] as DayKey
  const wh  = barberShopConfig.workingHours[key]
  return {
    closed:       wh.closed,
    openMinutes:  timeToMinutes(wh.open),
    closeMinutes: timeToMinutes(wh.close),
    openHour:     Math.floor(timeToMinutes(wh.open)  / 60),
    closeHour:    Math.floor(timeToMinutes(wh.close) / 60),
  }
}

const SLOT_H        = 18
const SLOT_DURATION = 15 // minutos por slot
const SLOTS_PER_H   = 60 / SLOT_DURATION

const TIPO_ICON: Record<UnavailableTipo, string> = {
  folga: '✈️', ferias: '🏖️', almoco: '🍴', ausencia: '🚫', outro: '📌',
}
const TIPO_LABEL: Record<UnavailableTipo, string> = {
  folga: 'Folga', ferias: 'Férias', almoco: 'Almoço', ausencia: 'Ausência', outro: 'Outro',
}
const STATUS_BAR_LOCAL: Record<string, string> = {
  confirmada: '#3b82f6', concluida: '#10b981', faltou: '#ef4444', cancelada: '#9ca3af',
}
function timeToSlot(iso: string, startH: number) {
  const d = new Date(iso)
  const totalMin = d.getHours() * 60 + d.getMinutes()
  const baseMin  = startH * 60
  const offset   = Math.max(0, totalMin - baseMin)
  return Math.floor(offset / SLOT_DURATION)
}
function slotToLabel(slot: number, startH: number) {
  const t = startH * 60 + slot * SLOT_DURATION
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}
function slotToISO(dateStr: string, slot: number, startH: number) {
  const t = startH * 60 + slot * SLOT_DURATION
  return `${dateStr}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '00')}:00`
}
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${alpha})`
}
function serviceShortLabel(serviceName: string, abbreviation?: string) {
  const short = (abbreviation ?? '').trim()
  if (short) return short.toUpperCase()
  return serviceName
    .split(' ')
    .map(part => part.trim().charAt(0))
    .join('')
    .slice(0, 5)
    .toUpperCase() || 'SV'
}

function hasReservationComment(comment?: string) {
  const raw = (comment ?? '').trim()
  if (!raw) return false
  return !/^\[\s*\]$/.test(raw)
}

function reservationNamePrefix(reservation: Reservation) {
  const indicators: string[] = []
  if (reservation.created_by === 'online') indicators.push('@')
  if (hasReservationComment(reservation.comentario)) indicators.push('💬')
  return indicators.length ? `${indicators.join('')} ` : ''
}

type ContextTarget =
  | { kind: 'slot';        barberId: number; slot: number }
  | { kind: 'reservation'; reservation: Reservation }
  | { kind: 'unavailable'; unavailable: Unavailable }

type CalModal =
  | { type: 'res_detail';  r: Reservation }
  | { type: 'res_edit';    r: Reservation }
  | { type: 'res_status';  r: Reservation; action: 'concluida' | 'faltou' | 'cancelada' }
  | { type: 'res_copy';    source: Reservation }
  | { type: 'res_new';     barberId: number; slot: number }
  | { type: 'unavail';     data: Partial<Unavailable>; isNew: boolean }
  | null

function useDebouncedDate(initial: string, delay = 600) {
  const [display, setDisplay] = useState(initial)
  const [committed, setCommitted] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChange = useCallback((val: string) => {
    setDisplay(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { if (val) setCommitted(val) }, delay)
  }, [delay])
  const setDate = useCallback((val: string) => {
    if (timer.current) clearTimeout(timer.current)
    setDisplay(val); setCommitted(val)
  }, [])
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  return { display, committed, onChange, setDate }
}

export default function CalendarPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()

  // ── Utilizador logado ────────────────────────────────────────────────────
  const adminUser = useAdminUser()
  const isAdmin = adminUser?.role === 'admin'
  const isBarber         = adminUser?.role === 'barbeiro'
  const loggedBarberId   = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null

  // ── Data seleccionada ────────────────────────────────────────────────────
  const { display: dateDisplay, committed: selectedDate, onChange: onDateInput, setDate: setSelectedDate } =
    useDebouncedDate(format(new Date(), 'yyyy-MM-dd'))

  // ── Filtro de barbeiro (apenas 1 coluna) ─────────────────────────────────
  // Se o user é barbeiro, forçar o seu id e não permitir alterar
  const [barberFilterId, setBarberFilterId] = useState<number | null>(loggedBarberId)
  const effectiveBarberId = loggedBarberId ?? barberFilterId

  // ── Horário do dia seleccionado ──────────────────────────────────────────
  const dayConfig = useMemo(() => {
    try { return getDayConfig(parseISO(selectedDate)) }
    catch { return getDayConfig(new Date()) }
  }, [selectedDate])

  const START_H     = dayConfig.openHour
  const END_H       = dayConfig.closeHour
  const TOTAL_SLOTS = (END_H - START_H) * SLOTS_PER_H
  const OPEN_H      = START_H
  const CLOSE_H     = END_H

  // ── Outros estados ───────────────────────────────────────────────────────
  const [ctx, setCtx]       = useState<ContextTarget | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [modal, setModal]   = useState<CalModal>(null)

  const [uForm, setUForm]     = useState<Partial<Unavailable> & { recurrence_end_date?: string }>({})
  const [uError, setUError]   = useState<string | null>(null)
  const [uSaving, setUSaving] = useState(false)
  const [uConflicts, setUConflicts] = useState<UnavailabilityConflictReservation[]>([])
  const [uPendingPayload, setUPendingPayload] = useState<Partial<Unavailable> | null>(null)

  const [copyDate, setCopyDate]     = useState('')
  const [copyTime, setCopyTime]     = useState('')
  const [copySaving, setCopySaving] = useState(false)
  const [copyEmail, setCopyEmail]   = useState(false)

  const [newResForm, setNewResForm]     = useState<Partial<Reservation & { sendEmail: boolean }>>({})
  const [newResSaving, setNewResSaving] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: barbersRes }  = useQuery({ queryKey: ['barbers'],   queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'],  queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
  const { data: resRes,  isLoading: loadingRes } = useQuery({
    queryKey: ['cal-reservations', selectedDate, effectiveBarberId],
    queryFn:  () => reservationsApi.list({ date: selectedDate, perPage: 200, barberId: effectiveBarberId ?? undefined }),
  })
  const { data: uRes, isLoading: loadingU } = useQuery({
    queryKey: ['cal-unavail', selectedDate, effectiveBarberId],
    queryFn:  () => barbersApi.listUnavailable({ date: selectedDate, barberId: effectiveBarberId ?? undefined }),
  })

  const activeBarbers: Barber[] = (barbersRes?.data ?? []).filter(b => b.active)
  const sortedActiveBarbers = useMemo(() => [...activeBarbers].sort((a, b) => a.id - b.id), [activeBarbers])
  // Barbeiros visíveis na grelha (filtrado por barbeiro logado ou filtro manual)
  const barbers: Barber[] = useMemo(() => {
    const base = loggedBarberId
      ? activeBarbers.filter(b => b.id === loggedBarberId)
      : barberFilterId
        ? activeBarbers.filter(b => b.id === barberFilterId)
        : [...activeBarbers]
    return base.sort((a, b) => a.id - b.id)
  }, [activeBarbers, loggedBarberId, barberFilterId])

  const services: Service[]         = (servicesRes?.data as unknown as Service[]) ?? []
  const reservations: Reservation[] = resRes?.data?.items ?? []
  const unavailable: Unavailable[]  = (uRes?.data as unknown as Unavailable[]) ?? []
  const isLoading = loadingRes || loadingU

  const changeDate = useCallback((delta: number) => {
    const dt = new Date(selectedDate + 'T12:00:00')
    dt.setDate(dt.getDate() + delta)
    setSelectedDate(format(dt, 'yyyy-MM-dd'))
  }, [selectedDate, setSelectedDate])

  const openCtx = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault(); e.stopPropagation()
    const MENU_WIDTH = 260
    // Alturas máximas aproximadas por tipo de menu para evitar cortar opções no fundo do ecrã.
    const MENU_HEIGHT_BY_KIND: Record<ContextTarget['kind'], number> = {
      slot: 110,
      unavailable: 110,
      reservation: 280,
    }
    const menuHeight = MENU_HEIGHT_BY_KIND[target.kind] ?? 220
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth  - MENU_WIDTH  - 8))
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8))
    setCtx(target); setCtxPos({ x, y })
  }
  const closeCtx = () => setCtx(null)
  const close    = () => setModal(null)

  const openNewReservation = (barberId: number, slot: number) => {
    setNewResForm({ barber_id: barberId, data_hora: slotToISO(selectedDate, slot, START_H), status: 'confirmada', sendEmail: true })
    setModal({ type: 'res_new', barberId, slot }); closeCtx()
  }
  const openNewUnavailable = (barberId: number, slot: number) => {
    const startIso = slotToISO(selectedDate, slot, START_H)
    const endIso   = slotToISO(selectedDate, slot + (60 / SLOT_DURATION), START_H)
    setUForm({ barbeiro_id: barberId, data_hora_inicio: startIso,
               data_hora_fim: endIso, is_all_day: 0, tipo: 'folga', motivo: '', recurrence_type: 'none' })
    setUError(null); setModal({ type: 'unavail', data: {}, isNew: true }); closeCtx()
  }
  const openEditUnavailable = (u: Unavailable) => {
    setUForm({ ...u }); setUError(null); setModal({ type: 'unavail', data: u, isNew: false }); closeCtx()
  }
  const handleDeleteUnavailable = async (u: Unavailable) => {
    if (!window.confirm(`Eliminar esta indisponibilidade (${TIPO_LABEL[u.tipo]})?`)) return
    try { await barbersApi.deleteUnavailable(u.id, { group: false }); qc.invalidateQueries({ queryKey: ['cal-unavail'] }); closeCtx() } catch {}
  }
  const handleSaveUnavailable = async () => {
    if (!uForm.barbeiro_id)      { setUError('Barbeiro obrigatório'); return }
    if (!uForm.data_hora_inicio) { setUError('Data de início obrigatória'); return }
    if (!uForm.data_hora_fim)    { setUError('Data de fim obrigatória'); return }
    if (uForm.data_hora_fim <= uForm.data_hora_inicio) { setUError('Fim deve ser posterior ao início'); return }
    setUSaving(true); setUError(null)
    try {
      const isNew = modal && 'isNew' in modal ? modal.isNew : false
      const payload: Partial<Unavailable> = { ...uForm }
      if (uForm.is_all_day) {
        const dayStart = (uForm.data_hora_inicio ?? `${selectedDate}T00:00:00`).substring(0, 10)
        const dayEnd   = (uForm.data_hora_fim    ?? uForm.data_hora_inicio ?? `${selectedDate}T00:00:00`).substring(0, 10)
        payload.data_hora_inicio = `${dayStart}T${String(OPEN_H).padStart(2,'0')}:00:00`
        payload.data_hora_fim    = `${dayEnd}T${String(CLOSE_H).padStart(2,'0')}:00:00`
      }
      if (isNew || !uForm.id) {
        const response = await barbersApi.createUnavailable(payload as Unavailable)
        if (!response.success) {
          const conflictData = response.data as { conflicts?: UnavailabilityConflictReservation[] } | undefined
          const conflicts = conflictData?.conflicts
            ?? ((response as unknown as { conflicts?: UnavailabilityConflictReservation[] }).conflicts ?? [])
          if (conflicts.length) {
            setUConflicts(conflicts)
            setUPendingPayload(payload)
            return
          }
          throw new Error(response.error ?? 'Erro ao guardar')
        }
      } else {
        const response = await barbersApi.updateUnavailable(uForm.id, payload as Unavailable)
        if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
      }
      qc.invalidateQueries({ queryKey: ['cal-unavail'] }); close()
    } catch (e: unknown) { setUError(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setUSaving(false) }
  }

  const handleCopy = async () => {
    if (modal?.type !== 'res_copy') return
    setCopySaving(true)
    const src = modal.source
    try {
      await adminApi.post('/api/admin/reservations', {
        client_id: src.client_id, service_id: src.service_id, barber_id: src.barber_id,
        date: copyDate, time: copyTime, notes: src.comentario ?? '', send_email: copyEmail,
      })
      qc.invalidateQueries({ queryKey: ['cal-reservations'] }); close()
    } catch {}
    finally { setCopySaving(false) }
  }

  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i)
  const dateLabel = useMemo(() => {
    try { return format(parseISO(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return selectedDate }
  }, [selectedDate])

  const resByBarberSlot = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach(r => {
      if (r.status === 'cancelada') return
      const slot = timeToSlot(r.data_hora, START_H)
      const key  = `${r.barber_id}_${slot}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations, START_H])

  const unavailByBarber = useMemo(() => {
    const map = new Map<number, Unavailable[]>()
    unavailable.forEach(u => {
      if (!map.has(u.barbeiro_id)) map.set(u.barbeiro_id, [])
      map.get(u.barbeiro_id)!.push(u)
    })
    return map
  }, [unavailable])

  function isSlotBlocked(barberId: number, slot: number): Unavailable | null {
    const barberU = unavailByBarber.get(barberId) ?? []
    const slotISO = slotToISO(selectedDate, slot, START_H)
    const slotEnd = slotToISO(selectedDate, slot + 1, START_H)
    return barberU.find(u => u.data_hora_inicio < slotEnd && u.data_hora_fim > slotISO) ?? null
  }

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-3" onClick={closeCtx}>
      {/* ── Barra de controlos ─────────────────────────────────────────── */}
      <Card padding="xs">
        <div className="flex flex-col gap-3">
          {/* Linha 1: navegação de data */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                      className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors">
                Hoje
              </button>
              <button onClick={() => changeDate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronLeft size={18} className="text-gray-600" />
              </button>
              <div className="flex items-center gap-2">
                <CalendarDays size={16} className="text-gray-500" />
                <span className="text-sm font-semibold text-gray-800 capitalize">{dateLabel}</span>
              </div>
              <button onClick={() => changeDate(1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                <ChevronRight size={18} className="text-gray-600" />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={dateDisplay} onChange={e => onDateInput(e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white
                           focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <select
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white min-w-[160px]
                           focus:outline-none focus:ring-2 focus:ring-brand-400"
                value={effectiveBarberId ?? ''}
                onChange={e => setBarberFilterId(e.target.value ? Number(e.target.value) : null)}
                disabled={!!loggedBarberId}
              >
                {!loggedBarberId && <option value="">Todos os barbeiros</option>}
                {sortedActiveBarbers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Dia fechado ────────────────────────────────────────────────── */}
      {dayConfig.closed ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">🔒</span>
            <p className="text-lg font-semibold text-gray-700">A barbearia está encerrada neste dia</p>
            <p className="text-sm text-gray-500">Seleciona outro dia para ver o calendário.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <div ref={gridRef} className="grid select-none"
              style={{ gridTemplateColumns: `3rem repeat(${barbers.length}, minmax(140px, 1fr))`, minWidth: 3*16 + barbers.length*140 }}>

              {/* Cabeçalho */}
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 h-10" />
              {barbers.map(b => (
                <div key={b.id} className="sticky top-0 z-10 h-10 flex items-center justify-center border-b border-l"
                  style={{ background: b.color ?? '#d4a017', borderColor: hexToRgba(b.color ?? '#d4a017', 0.4) }}>
                  <span className="text-xs font-bold text-white drop-shadow-sm">{b.name}</span>
                </div>
              ))}

              {/* Slots */}
              {timeSlots.map(slot => {
                const isHourEnd = (slot + 1) % SLOTS_PER_H === 0
                return (
                  <>
                    <div key={`t_${slot}`}
                      className={`flex items-top justify-center ${
                        isHourEnd ? 'border-b-2 border-gray-200' : 'border-b border-gray-100'
                      }`}
                      style={{ height: SLOT_H }}
                    >
                      {slot % SLOTS_PER_H === 0 && (
                        <span className="text-[11px] text-gray-400">{slotToLabel(slot, START_H)}</span>
                      )}
                    </div>

                    {barbers.map(b => {
                      const blocked = isSlotBlocked(b.id, slot)
                      const key     = `${b.id}_${slot}`
                      const rList   = resByBarberSlot.get(key) ?? []
                      const colBg   = hexToRgba(b.color ?? '#d4a017', 0.1)
                      const baseCellClasses = isHourEnd
                        ? 'relative border-l border-b-2 border-gray-300'
                        : 'relative border-l border-b border-gray-200'

                      if (!blocked && rList.length === 0) {
                        return (
                          <div key={key}
                            className={`${baseCellClasses} hover:brightness-95 transition-all cursor-pointer`}
                            style={{ height: SLOT_H, background: colBg }}
                            onClick={e => openCtx(e, { kind: 'slot', barberId: b.id, slot })}
                          />
                        )
                      }

                      const isFirstBlockedSlot = blocked && (
                        blocked.data_hora_inicio === slotToISO(selectedDate, slot, START_H)
                        || (slot === 0 && new Date(blocked.data_hora_inicio) <= new Date(slotToISO(selectedDate, 0, START_H)))
                      )

                      return (
                        <div
                          key={key}
                          className={`${baseCellClasses} ${blocked ? 'cursor-pointer' : ''}`}
                          style={{
                            height: SLOT_H,
                            background: blocked ? undefined : colBg,
                            backgroundImage: blocked
                              ? `repeating-linear-gradient(135deg,${hexToRgba(b.color ?? '#d4a017', 0.18)} 0px,${hexToRgba(b.color ?? '#d4a017', 0.18)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 12px)`
                              : undefined,
                          }}
                          onClick={blocked ? (e => openCtx(e, { kind: 'unavailable', unavailable: blocked })) : undefined}
                        >
                          {blocked && isFirstBlockedSlot && (
                            <div className="absolute inset-x-1 top-0.5 flex items-center gap-1 z-10">
                              <span className="text-sm leading-none">{TIPO_ICON[blocked.tipo]}</span>
                              <span className="text-[13px] font-medium text-gray-700 truncate">
                                {TIPO_LABEL[blocked.tipo]}{blocked.motivo ? ` · ${blocked.motivo}` : ''}
                                {blocked.recurrence_group_id ? ' 🔁' : ''}
                              </span>
                            </div>
                          )}
                          {rList.map(r => {
                            const service   = services.find(s => s.id === r.service_id)
                            const baseColor = service?.color || b.color || '#888'
                            const dur       = r.service_duration ?? service?.duration ?? 60
                            const shortLabel = serviceShortLabel(r.service_name, service?.abreviacao)
                            const compact = dur < 30
                            const heightPx  = Math.max(SLOT_H, Math.round((dur / SLOT_DURATION) * SLOT_H))
                            const barColor2 = STATUS_BAR_LOCAL[r.status] ?? baseColor
                            return (
                              <div key={r.id}
                                className="absolute inset-x-0.5 top-0 rounded overflow-hidden cursor-pointer flex flex-col justify-start pl-2.5 pr-1 py-0.5 z-20"
                                style={{
                                  background: hexToRgba(baseColor, 0.9),
                                  height: heightPx, minHeight: SLOT_H,
                                  borderLeft: `4px solid ${barColor2}`,
                                }}
                                onClick={e => openCtx(e, { kind: 'reservation', reservation: r })}
                              >
                                {compact ? (
                                  <p className="text-[12px] font-semibold leading-tight truncate text-black whitespace-nowrap">
                                    {shortLabel} {reservationNamePrefix(r)}{r.client_name}
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-[13px] font-semibold leading-4 truncate text-black">{reservationNamePrefix(r)}{r.client_name}</p>
                                    <p className="text-[12px] leading-4 truncate text-black/90">{r.service_name} - {format(new Date(r.data_hora),'HH:mm')}–{format(addMinutes(new Date(r.data_hora),dur),'HH:mm')}</p>                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </>
                )
              })}
            </div>
          </div>
        </Card>
      )}

      {/* ── Context menu ──────────────────────────────────────────────── */}
      {ctx && (
        <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 min-w-[210px] text-sm"
          style={{ top: ctxPos.y, left: ctxPos.x }} onClick={e => e.stopPropagation()}>
          {ctx.kind === 'slot' && (
            <>
              <CtxItem icon="📅" label="Nova reserva"       onClick={() => openNewReservation(ctx.barberId, ctx.slot)} />
              <CtxItem icon="🚫" label="Marcar indisponível" onClick={() => openNewUnavailable(ctx.barberId, ctx.slot)} />
            </>
          )}
          {ctx.kind === 'reservation' && (() => {
            const r = ctx.reservation
            return (
              <>
                <CtxItem icon="👁️" label="Ver Reserva"   onClick={() => { setModal({ type: 'res_detail', r }); closeCtx() }} />
                {isAdmin && (
                  <CtxItem icon="🧑" label="Ver cliente" onClick={() => { navigate(`/admin/clientes/${r.client_id}`); closeCtx() }} />
                )}
                <CtxItem icon="✏️" label="Editar Reserva" onClick={() => { setModal({ type: 'res_edit',   r }); closeCtx() }} />
                <CtxItem icon="📋" label="Copiar Reserva" onClick={() => { setCopyDate(selectedDate); setCopyTime(format(new Date(r.data_hora),'HH:mm')); setCopyEmail(true); setModal({ type: 'res_copy', source: r }); closeCtx() }} />
                <div className="border-t border-gray-100 my-1" />
                {r.status !== 'concluida' && r.status !== 'cancelada' && r.status !== 'faltou' && (
                  <CtxItem icon="✅" label="Chegou" onClick={() => { setModal({ type: 'res_status', r, action: 'concluida' }); closeCtx() }} />
                )}
                {r.status !== 'faltou' && r.status !== 'cancelada' && (
                  <CtxItem icon="👤" label="Faltou" onClick={() => { setModal({ type: 'res_status', r, action: 'faltou'    }); closeCtx() }} />
                )}
                <CtxItem icon="❌" label="Cancelar Reserva"
                  onClick={() => { setModal({ type: 'res_status', r, action: 'cancelada' }); closeCtx() }}
                  className="text-red-600" />
              </>
            )
          })()}
          {ctx.kind === 'unavailable' && (
            <>
              <CtxItem icon="✏️" label="Editar"   onClick={() => openEditUnavailable(ctx.unavailable)} />
              <CtxItem icon="🗑️" label="Eliminar" onClick={() => handleDeleteUnavailable(ctx.unavailable)} className="text-red-600" />
              {ctx.unavailable.recurrence_group_id && (
                <p className="px-4 py-1 text-[10px] text-gray-400 italic">Recorrência – edita o grupo na página de indisponibilidades</p>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Modais de reservas ─────────────────────────────────────────── */}
      {modal?.type === 'res_detail' && (
        <ReservationDetailModal reservation={modal.r} onClose={close}
          onEdit={() => setModal({ type: 'res_edit', r: modal.r })}
          onChangeStatus={action => setModal({ type: 'res_status', r: modal.r, action })}
          onCancel={() => setModal({ type: 'res_status', r: modal.r, action: 'cancelada' })} />
      )}
      {modal?.type === 'res_edit' && (
        <ReservationEditModal reservation={modal.r} invalidateKey="cal-reservations" onClose={close} />
      )}
      {modal?.type === 'res_status' && (
        <ReservationStatusModal reservation={modal.r} action={modal.action} invalidateKey="cal-reservations" onClose={close} />
      )}

      {/* Modal copiar reserva */}
      <Modal open={modal?.type === 'res_copy'} onClose={close} title="Copiar reserva"
        footer={
          <>
            <button className="btn-secondary" onClick={close}>Cancelar</button>
            <button className="btn-primary" onClick={handleCopy} disabled={copySaving}>
              {copySaving ? 'A criar...' : 'Criar reserva'}
            </button>
          </>
        }>
        {modal?.type === 'res_copy' ? (
          <ReservationCopyContent
            clientName={modal.source.client_name}
            serviceName={modal.source.service_name}
            barberName={modal.source.barber_name}
            copyDate={copyDate}
            copyTime={copyTime}
            copyEmail={copyEmail}
            onChange={(field, value) => {
              if (field === 'copyDate' && typeof value === 'string') setCopyDate(value)
              if (field === 'copyTime' && typeof value === 'string') setCopyTime(value)
              if (field === 'copyEmail' && typeof value === 'boolean') setCopyEmail(value)
            }}
          />
        ) : <></>}
      </Modal>

      {/* Modal nova reserva */}
      <Modal open={modal?.type === 'res_new'} onClose={close} title="Nova reserva">
        {modal?.type === 'res_new' ? (
          <NewReservationForm
            barberId={modal.barberId} slot={modal.slot}
            selectedDate={selectedDate} startH={START_H} barbers={barbers} services={services}
            form={newResForm} saving={newResSaving}
            onChange={(k, v) => setNewResForm(f => ({ ...f, [k]: v }))}
            onSave={async () => {
              if (!newResForm.client_id || !newResForm.service_id || !newResForm.barber_id || !newResForm.data_hora) return
              const iso = newResForm.data_hora as string
              const [date, timeFull] = iso.split('T')
              const time = (timeFull ?? '').slice(0, 5)
              setNewResSaving(true)
              try {
                await adminApi.post('/api/admin/reservations', {
                  client_id: newResForm.client_id, service_id: newResForm.service_id,
                  barber_id: newResForm.barber_id, date, time,
                  notes: newResForm.comentario ?? '', send_email: newResForm.sendEmail ?? false,
                  service_duration: newResForm.service_duration,
                })
                qc.invalidateQueries({ queryKey: ['cal-reservations'] }); close()
              } catch {}
              finally { setNewResSaving(false) }
            }}
            onCancel={close}
          />
        ) : <></>}
      </Modal>

      {/* Modal indisponibilidade */}
      <Modal open={modal?.type === 'unavail'} onClose={close}
        title={modal?.type === 'unavail' && modal.isNew ? 'Nova indisponibilidade' : 'Editar indisponibilidade'}>
        {modal?.type === 'unavail' ? (
          <UnavailableEditorForm form={uForm} barbers={barbers} isNew={modal.isNew}
            error={uError} saving={uSaving}
            disableBarberSelection={!!loggedBarberId}
            onChange={(k, v) => setUForm(f => ({ ...f, [k]: v }))}
            onSave={handleSaveUnavailable} onCancel={close} />
        ) : <></>}
      </Modal>

      <UnavailabilityConflictsModal
        open={uConflicts.length > 0}
        reservations={uConflicts}
        saving={uSaving}
        onCancel={() => {
          setUConflicts([])
          setUPendingPayload(null)
        }}
        onConfirm={async ({ selectedIds, reason }) => {
          if (!uPendingPayload) return
          setUSaving(true)
          setUError(null)
          try {
            const response = await barbersApi.createUnavailable({
              ...(uPendingPayload as Unavailable),
              skip_conflict_check: true,
              cancel_reservation_ids: selectedIds,
              cancel_reason: reason,
            })
            if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
            qc.invalidateQueries({ queryKey: ['cal-unavail'] })
            qc.invalidateQueries({ queryKey: ['cal-reservations'] })
            setUConflicts([])
            setUPendingPayload(null)
            close()
          } catch (e: unknown) {
            setUError(e instanceof Error ? e.message : 'Erro ao guardar')
          } finally {
            setUSaving(false)
          }
        }}
      />
    </div>
  )
}

function CtxItem({ icon, label, onClick, className = '', loading = false }: {
  icon: string; label: string; onClick: () => void; className?: string; loading?: boolean
}) {
  return (
    <button className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors flex items-center gap-2.5 ${className}`}
      onClick={onClick} disabled={loading}>
      <span className="text-base w-5 text-center leading-none">{icon}</span>
      <span>{loading ? 'A guardar...' : label}</span>
    </button>
  )
}
