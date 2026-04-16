import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { clientsApi } from '@/api/clients'
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

const SLOT_H        = 20
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
const TIPO_OPTIONS: UnavailableTipo[] = ['folga', 'ferias', 'almoco', 'ausencia', 'outro']

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

  // ── Utilizador logado ────────────────────────────────────────────────────
  const adminUser = useMemo(() => {
    try { const r = localStorage.getItem('admin_user'); return r ? JSON.parse(r) as { role?: string; barbeiro_id?: number } : null }
    catch { return null }
  }, [])
  const isBarber         = adminUser?.role === 'barbeiro'
  const loggedBarberId   = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null

  // ── Data seleccionada ────────────────────────────────────────────────────
  const { display: dateDisplay, committed: selectedDate, onChange: onDateInput, setDate: setSelectedDate } =
    useDebouncedDate(format(new Date(), 'yyyy-MM-dd'))

  // ── Filtro de barbeiro (apenas 1 coluna) ─────────────────────────────────
  // Se o user é barbeiro, forçar o seu id e não permitir alterar
  const [barberFilterId, setBarberFilterId] = useState<number | null>(loggedBarberId)

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
    queryKey: ['cal-reservations', selectedDate],
    queryFn:  () => reservationsApi.list({ date: selectedDate, perPage: 200 }),
  })
  const { data: uRes, isLoading: loadingU } = useQuery({
    queryKey: ['cal-unavail', selectedDate],
    queryFn:  () => barbersApi.listUnavailable({ date: selectedDate }),
  })

  const allBarbers: Barber[] = barbersRes?.data ?? []
  // Barbeiros visíveis na grelha (filtrado por barbeiro logado ou filtro manual)
  const barbers: Barber[] = useMemo(() => {
    const base = loggedBarberId
      ? allBarbers.filter(b => b.id === loggedBarberId)
      : barberFilterId
        ? allBarbers.filter(b => b.id === barberFilterId)
        : [...allBarbers]
    return base.sort((a, b) => a.id - b.id)
  }, [allBarbers, loggedBarberId, barberFilterId])

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
    const MENU_HEIGHT = 220, MENU_WIDTH = 260
    const x = Math.min(e.clientX, window.innerWidth  - MENU_WIDTH  - 8)
    const y = Math.min(e.clientY, window.innerHeight - MENU_HEIGHT - 8)
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
      const payload = { ...uForm }
      if (uForm.is_all_day) {
        const dayStart = (uForm.data_hora_inicio ?? `${selectedDate}T00:00:00`).substring(0, 10)
        const dayEnd   = (uForm.data_hora_fim    ?? uForm.data_hora_inicio ?? `${selectedDate}T00:00:00`).substring(0, 10)
        payload.data_hora_inicio = `${dayStart}T${String(OPEN_H).padStart(2,'0')}:00:00`
        payload.data_hora_fim    = `${dayEnd}T${String(CLOSE_H).padStart(2,'0')}:00:00`
      }
      if (isNew || !uForm.id) await barbersApi.createUnavailable(payload as Unavailable)
      else                    await barbersApi.updateUnavailable(uForm.id, payload as Unavailable)
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
              <button onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors">
                Hoje
              </button>
            </div>
            <input type="date" value={dateDisplay} onChange={e => onDateInput(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white
                         focus:outline-none focus:ring-2 focus:ring-brand-400" />
          </div>

          {/* Linha 2: filtro por barbeiro (oculta se user é barbeiro) */}
          {!isBarber && allBarbers.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-gray-500 mr-1">Barbeiro:</span>
              <button
                onClick={() => setBarberFilterId(null)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                  barberFilterId === null
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                }`}
              >
                Todos
              </button>
              {allBarbers.sort((a,b) => a.id - b.id).map(b => (
                <button
                  key={b.id}
                  onClick={() => setBarberFilterId(barberFilterId === b.id ? null : b.id)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                    barberFilterId === b.id
                      ? 'text-white border-transparent'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                  style={barberFilterId === b.id ? { background: b.color ?? '#6b7280', borderColor: b.color ?? '#6b7280' } : {}}
                >
                  {b.name}
                </button>
              ))}
            </div>
          )}
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

                      if (blocked) {
                        const isFirst = blocked.data_hora_inicio === slotToISO(selectedDate, slot, START_H)
                          || (slot === 0 && new Date(blocked.data_hora_inicio) <= new Date(slotToISO(selectedDate, 0, START_H)))
                        return (
                          <div key={key}
                            className={`${baseCellClasses} cursor-pointer`}
                            style={{
                              height: SLOT_H,
                              backgroundImage: `repeating-linear-gradient(135deg,${hexToRgba(b.color ?? '#d4a017', 0.18)} 0px,${hexToRgba(b.color ?? '#d4a017', 0.18)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 12px)`,
                            }}
                            onClick={e => openCtx(e, { kind: 'unavailable', unavailable: blocked })}
                          >
                            {isFirst && (
                              <div className="absolute inset-x-1 top-0.5 flex items-center gap-1 z-10">
                                <span className="text-sm leading-none">{TIPO_ICON[blocked.tipo]}</span>
                                <span className="text-[10px] font-medium text-gray-700 truncate">
                                  {TIPO_LABEL[blocked.tipo]}{blocked.motivo ? ` · ${blocked.motivo}` : ''}
                                  {blocked.recurrence_group_id ? ' 🔁' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        )
                      }

                      if (rList.length === 0) {
                        return (
                          <div key={key}
                            className={`${baseCellClasses} hover:brightness-95 transition-all cursor-pointer`}
                            style={{ height: SLOT_H, background: colBg }}
                            onClick={e => openCtx(e, { kind: 'slot', barberId: b.id, slot })}
                          />
                        )
                      }

                      return (
                        <div key={key} className={baseCellClasses} style={{ height: SLOT_H, background: colBg }}>
                          {rList.map(r => {
                            const service   = services.find(s => s.id === r.service_id)
                            const baseColor = service?.color || b.color || '#888'
                            const dur       = r.service_duration ?? service?.duration ?? 60
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
                                <p className="text-[10px] font-semibold leading-tight truncate text-white">{r.client_name}</p>
                                <p className="text-[9px] leading-tight truncate text-white/90">{r.service_name}</p>
                                {heightPx > SLOT_H && (
                                  <p className="text-[9px] leading-tight text-white/70">
                                    {format(new Date(r.data_hora),'HH:mm')}–{format(addMinutes(new Date(r.data_hora),dur),'HH:mm')}
                                  </p>
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
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p><span className="text-gray-500">Cliente:</span> <strong>{modal.source.client_name}</strong></p>
              <p><span className="text-gray-500">Serviço:</span> <strong>{modal.source.service_name}</strong></p>
              <p><span className="text-gray-500">Barbeiro:</span> <strong>{modal.source.barber_name}</strong></p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nova data</label>
                <input type="date" value={copyDate} onChange={e => setCopyDate(e.target.value)} className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Hora</label>
                <input type="time" value={copyTime} onChange={e => setCopyTime(e.target.value)} className="input text-sm w-full" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={copyEmail} onChange={e => setCopyEmail(e.target.checked)} />
              <span>Enviar email de confirmação ao cliente</span>
            </label>
          </div>
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
          <UnavailableForm form={uForm} barbers={barbers} isNew={modal.isNew}
            error={uError} saving={uSaving}
            onChange={(k, v) => setUForm(f => ({ ...f, [k]: v }))}
            onSave={handleSaveUnavailable} onCancel={close} />
        ) : <></>}
      </Modal>
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

function ClientSearch({ value, onChange }: { value?: number; onChange: (id: number, name: string) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const onType = (v: string) => {
    setQ(v); setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDq(v), 350)
  }
  const { data } = useQuery({
    queryKey: ['client-search', dq],
    queryFn:  () => clientsApi.list({ search: dq, page: 1, perPage: 8 }),
    enabled:  dq.length >= 1,
  })
  const results = data?.data?.items ?? []
  return (
    <div className="relative">
      <input type="text" placeholder="Pesquisar cliente por nome / email / telefone"
        value={q} onChange={e => onType(e.target.value)}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input text-sm w-full" />
      {open && results.length > 0 && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(c => (
            <li key={c.id} className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between"
              onMouseDown={() => { onChange(c.id, c.name); setQ(c.name); setOpen(false) }}>
              <span className="font-medium">{c.name}</span>
              <span className="text-xs text-gray-400">{c.phone ?? c.email ?? ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function NewReservationForm({ barberId, slot, selectedDate, startH, barbers, services, form, saving, onChange, onSave, onCancel }: {
  barberId: number; slot: number; selectedDate: string; startH: number; barbers: Barber[]; services: Service[]
  form: Partial<Reservation & { sendEmail: boolean }>
  saving: boolean
  onChange: (k: string, v: unknown) => void
  onSave: () => void; onCancel: () => void
}) {
  const iso = slotToISO(selectedDate, slot, startH)
  const [newClientMode, setNewClientMode] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [newClientEmail, setNewClientEmail] = useState('')
  const [newClientPhone, setNewClientPhone] = useState('')
  const [creatingClient, setCreatingClient] = useState(false)

  const handleCreateClient = async () => {
    if (!newClientName.trim()) return
    setCreatingClient(true)
    try {
      const res = await clientsApi.create({ name: newClientName.trim(), email: newClientEmail.trim() || undefined, phone: newClientPhone.trim() || undefined })
      if (res.success && res.data) { onChange('client_id', res.data.id); onChange('client_name', res.data.name); setNewClientMode(false) }
    } finally { setCreatingClient(false) }
  }

  return (
    <div className="space-y-3 text-sm">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs text-gray-500">Cliente <span className="text-red-400">*</span></label>
          <button type="button" onClick={() => setNewClientMode(v => !v)} className="text-[11px] text-brand-700 hover:text-brand-800">
            {newClientMode ? 'Escolher existente' : 'Criar novo'}
          </button>
        </div>
        {newClientMode ? (
          <div className="space-y-2 border rounded-xl p-3 bg-gray-50">
            <input type="text" placeholder="Nome do cliente" className="input text-sm w-full" value={newClientName} onChange={e => setNewClientName(e.target.value)} />
            <input type="email" placeholder="Email (opcional)" className="input text-sm w-full" value={newClientEmail} onChange={e => setNewClientEmail(e.target.value)} />
            <input type="tel" placeholder="Telefone (opcional)" className="input text-sm w-full" value={newClientPhone} onChange={e => setNewClientPhone(e.target.value)} />
            <button type="button" onClick={handleCreateClient} disabled={creatingClient || !newClientName.trim()} className="btn-primary w-full text-xs mt-1 disabled:opacity-50">
              {creatingClient ? 'A criar cliente...' : 'Criar e associar cliente'}
            </button>
          </div>
        ) : (
          <ClientSearch value={form.client_id} onChange={(id, name) => { onChange('client_id', id); onChange('client_name', name) }} />
        )}
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
        <select value={form.barber_id ?? barberId} onChange={e => onChange('barber_id', Number(e.target.value))} className="input text-sm w-full">
          {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Serviço <span className="text-red-400">*</span></label>
        <select value={form.service_id ?? ''} onChange={e => onChange('service_id', Number(e.target.value))} className="input text-sm w-full">
          <option value="">Selecionar serviço</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
        <input type="datetime-local" value={(form.data_hora ?? iso).substring(0,16)} onChange={e => onChange('data_hora', e.target.value + ':00')} className="input text-sm w-full" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
        <textarea rows={2} value={form.comentario ?? ''} onChange={e => onChange('comentario', e.target.value)} placeholder="Observações para o barbeiro..." className="input text-sm w-full resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!form.sendEmail} onChange={e => onChange('sendEmail', e.target.checked)} />
        <span>Enviar email de confirmação ao cliente</span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
        <button onClick={onSave} disabled={saving || !form.client_id || !form.service_id} className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'A criar...' : 'Criar reserva'}
        </button>
      </div>
    </div>
  )
}

interface UnavailableFormProps {
  form: Partial<Unavailable> & { recurrence_end_date?: string }
  barbers: Barber[]; isNew: boolean; error: string | null; saving: boolean
  onChange: (k: string, v: unknown) => void; onSave: () => void; onCancel: () => void
}
function UnavailableForm({ form, barbers, isNew, error, saving, onChange, onSave, onCancel }: UnavailableFormProps) {
  const fmtLocal = (iso?: string) => iso ? iso.substring(0, 16) : ''
  return (
    <div className="space-y-3">
      {isNew && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
          <select value={form.barbeiro_id ?? ''} onChange={e => onChange('barbeiro_id', Number(e.target.value))} className="input text-sm w-full">
            <option value="">Selecionar barbeiro</option>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      )}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Tipo</label>
        <select value={form.tipo ?? 'folga'} onChange={e => onChange('tipo', e.target.value)} className="input text-sm w-full">
          {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {TIPO_LABEL[t]}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Motivo (opcional)</label>
        <input type="text" value={form.motivo ?? ''} onChange={e => onChange('motivo', e.target.value)} placeholder="Ex.: consulta médica" className="input text-sm w-full" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="iad" checked={!!form.is_all_day} onChange={e => onChange('is_all_day', e.target.checked ? 1 : 0)} />
        <label htmlFor="iad" className="text-xs text-gray-600">Dia inteiro</label>
      </div>
      {form.is_all_day ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input type="date" value={form.data_hora_inicio?.substring(0,10)??''} onChange={e => onChange('data_hora_inicio', e.target.value+'T00:00:00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input type="date" value={form.data_hora_fim?.substring(0,10)??''} onChange={e => onChange('data_hora_fim', e.target.value+'T23:59:00')} className="input text-xs w-full" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_inicio)} onChange={e => onChange('data_hora_inicio', e.target.value+':00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_fim)} onChange={e => onChange('data_hora_fim', e.target.value+':00')} className="input text-xs w-full" />
          </div>
        </div>
      )}
      {isNew && (
        <>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recorrência</label>
            <select value={form.recurrence_type ?? 'none'} onChange={e => onChange('recurrence_type', e.target.value)} className="input text-sm w-full">
              <option value="none">Sem recorrência</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          {form.recurrence_type && form.recurrence_type !== 'none' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até à data</label>
              <input type="date" value={form.recurrence_end_date??''} onChange={e => onChange('recurrence_end_date', e.target.value)} className="input text-xs w-full" />
            </div>
          )}
        </>
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
        <button onClick={onSave} disabled={saving} className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'A guardar...' : 'Guardar'}
        </button>
      </div>
    </div>
  )
}
