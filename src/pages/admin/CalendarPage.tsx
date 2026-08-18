import React, { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { adminApi } from '@/api/client'
import { barberShopConfig, WORKING_HOURS_CONFIG  } from '@/config/theme'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import {
  ReservationDetailModal,
  ReservationEditModal,
  ReservationStatusModal,
  CheckoutModal,
} from '@/components/admin/reservation-modals'
import type { Reservation, Barber, Unavailable, UnavailableTipo, Service, ConflictReservation } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'
import { NewReservationForm, ReservationCopyContent } from '@/components/admin/calendar/forms'
import { UnavailableEditorForm } from '@/components/admin/unavailable/UnavailableEditorForm'
import { ConflictReservationsModal } from '@/components/admin/unavailable/ConflictReservationsModal'
import { ClientDetailModal } from '@/components/admin/client-detail-modal'
import { hasMeaningfulReservationComment } from '@/utils/reservationComments'

// ─── Horário dinâmico a partir do theme.ts ───────────────────────────────────
const DAY_KEYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const
type DayKey = typeof DAY_KEYS[number]

function timeToMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + (m ?? 0)
}

function getDayConfig(date: Date) {
  const key = DAY_KEYS[date.getDay()] as DayKey
  const wh  = WORKING_HOURS_CONFIG[key]
  return {
    closed:            wh.closed,
    openMinutes:       timeToMinutes(wh.open),
    closeMinutes:      timeToMinutes(wh.close),
    openHour:          Math.floor(timeToMinutes(wh.open)  / 60),
    closeHour:         Math.floor(timeToMinutes(wh.close) / 60),
    breakStartMinutes: wh.breakStart ? timeToMinutes(wh.breakStart) : null,
    breakEndMinutes:   wh.breakEnd   ? timeToMinutes(wh.breakEnd)   : null,
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
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '00')}`
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

type ContextTarget =
  | { kind: 'slot';        barberId: number; slot: number }
  | { kind: 'reservation'; reservation: Reservation }
  | { kind: 'unavailable'; unavailable: Unavailable }

type CalModal =
  | { type: 'res_detail';     r: Reservation }
  | { type: 'res_edit';       r: Reservation }
  | { type: 'res_status';     r: Reservation; action: 'faltou' | 'cancelada' }
  | { type: 'res_checkout';   r: Reservation; editMode?: boolean; pendingEditForm?: Partial<Reservation & { sendEmail: boolean }> }
  | { type: 'res_copy';       source: Reservation }
  | { type: 'res_new';        barberId: number; slot: number }
  | { type: 'unavail';        data: Partial<Unavailable>; isNew: boolean }
  | { type: 'client_detail';  clientId: number; initialClientName: string; initialClientPhone?: string; initialClientEmail?: string }
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
  const [searchParams, setSearchParams] = useSearchParams()

  // ── Utilizador logado ────────────────────────────────────────────────────
  const adminUser = useAdminUser()
  const isBarber         = adminUser?.role === 'barbeiro'
  const isAdmin          = adminUser?.role === 'admin' || adminUser?.role === 'superAdmin'
  const loggedBarberId   = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null

  // ── Data seleccionada ────────────────────────────────────────────────────
  const initialDateFromUrl = searchParams.get('date')
  const initialDate        = initialDateFromUrl || format(new Date(), 'yyyy-MM-dd')

  const { display: dateDisplay, committed: selectedDate, onChange: onDateInput, setDate: setSelectedDate } =
    useDebouncedDate(initialDate)

  // Capturar reservationId do URL na montagem, antes de o URL ser limpo
  useEffect(() => {
    const rid = searchParams.get('reservationId')
    if (rid) {
      const n = Number(rid)
      if (Number.isFinite(n)) pendingReservationIdRef.current = n
    }
  }, [searchParams])

  // Sincronizar alteração de data com URL para permitir deep-linking
  useEffect(() => {
    const current = new URLSearchParams(searchParams)
    current.set('date', selectedDate)
    current.delete('reservationId')
    setSearchParams(current, { replace: true })
  }, [selectedDate, searchParams, setSearchParams])

  // ── Filtro de barbeiro (apenas 1 coluna) ─────────────────────────────────
  const [barberFilterId, setBarberFilterId] = useState<number | null>(loggedBarberId)
  const effectiveBarberId = loggedBarberId ?? barberFilterId

  // ── Horário do dia seleccionado ──────────────────────────────────────────
  const dayConfig = useMemo(() => {
    try { return getDayConfig(parseISO(selectedDate)) }
    catch { return getDayConfig(new Date()) }
  }, [selectedDate])

  // ── Outros estados ───────────────────────────────────────────────────────
  const [ctx, setCtx]       = useState<ContextTarget | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [modal, setModal]   = useState<CalModal>(null)

  const [uForm, setUForm]     = useState<Partial<Unavailable> & { recurrence_end_date?: string }>({})
  const [uError, setUError]   = useState<string | null>(null)
  const [uSaving, setUSaving] = useState(false)

  const [conflictModal, setConflictModal]               = useState(false)
  const [conflictReservations, setConflictReservations] = useState<ConflictReservation[]>([])
  const [pendingUForm, setPendingUForm]                 = useState<Partial<Unavailable> | null>(null)
  const [conflictSaving, setConflictSaving]             = useState(false)

  const [copyDate, setCopyDate]     = useState('')
  const [copyTime, setCopyTime]     = useState('')
  const [copySaving, setCopySaving] = useState(false)
  const [recurrenceInterval, setRecurrenceInterval] = useState('none')
  const [recurrenceCount, setRecurrenceCount]       = useState(4)

  const [newResForm, setNewResForm]     = useState<Partial<Reservation & { sendEmail: boolean; nota_privada: string }>>({})
  const [newResSaving, setNewResSaving] = useState(false)

  const [overlapReservations, setOverlapReservations] = useState<Reservation[] | null>(null)

  const gridRef = useRef<HTMLDivElement>(null)
  const pendingReservationIdRef = useRef<number | null>(null)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: barbersRes }  = useQuery({ queryKey: ['barbers'],   queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'],  queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
  const { data: resRes,  isLoading: loadingRes } = useQuery({
    queryKey: ['cal-reservations', selectedDate, effectiveBarberId],
    queryFn:  () => reservationsApi.list({ date: selectedDate, perPage: 200, barberId: effectiveBarberId ?? undefined }),
    refetchInterval: 30_000,
  })
  const { data: uRes, isLoading: loadingU } = useQuery({
    queryKey: ['cal-unavail', selectedDate, effectiveBarberId],
    queryFn:  () => barbersApi.listUnavailable({ date: selectedDate, barberId: effectiveBarberId ?? undefined }),
    refetchInterval: 30_000,
  })

  const activeBarbers: Barber[] = (barbersRes?.data ?? []).filter(b => b.active)
  const sortedActiveBarbers = useMemo(() => [...activeBarbers].sort((a, b) => a.id - b.id), [activeBarbers])
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

  const BUSINESS_OPEN_H  = dayConfig.openHour
  const BUSINESS_CLOSE_H = dayConfig.closeHour

  const {
    START_H,
    END_H,
    TOTAL_SLOTS,
    BREAK_START_SLOT,
    BREAK_END_SLOT,
  } = useMemo(() => {
    // minutos de abertura/fecho segundo o config
    let openMin  = dayConfig.openMinutes
    let closeMin = dayConfig.closeMinutes

    if (reservations.length > 0) {
      let earliest = openMin
      let latest   = closeMin

      reservations.forEach(r => {
        const d = new Date(r.data_hora)
        const start = d.getHours() * 60 + d.getMinutes()

        const service = services.find(s => s.id === r.service_id)
        const dur = r.service_duration ?? service?.duration ?? 60
        const end = start + dur

        if (start < earliest) earliest = start
        if (end > latest)    latest   = end
      })

      openMin  = earliest
      closeMin = latest
    }

    const startH = Math.floor(openMin / 60)
    const endH   = Math.ceil(closeMin / 60)

    const totalSlots = (endH - startH) * SLOTS_PER_H

    const breakStartSlot = dayConfig.breakStartMinutes != null
        ? Math.floor((dayConfig.breakStartMinutes - openMin) / SLOT_DURATION)
        : null

    const breakEndSlot = dayConfig.breakEndMinutes != null
        ? Math.floor((dayConfig.breakEndMinutes - openMin) / SLOT_DURATION)
        : null

    return {
      START_H: startH,
      END_H: endH,
      TOTAL_SLOTS: totalSlots,
      BREAK_START_SLOT: breakStartSlot,
      BREAK_END_SLOT: breakEndSlot,
    }
  }, [dayConfig, reservations, services])

  const changeDate = useCallback((delta: number) => {
    const dt = new Date(selectedDate + 'T12:00:00')
    dt.setDate(dt.getDate() + delta)
    setSelectedDate(format(dt, 'yyyy-MM-dd'))
  }, [selectedDate, setSelectedDate])

  const openCtx = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault(); e.stopPropagation()
    const MENU_WIDTH = 260
    const MENU_HEIGHT_BY_KIND: Record<ContextTarget['kind'], number> = {
      slot: 110,
      unavailable: 110,
      reservation: 320,
    }
    const menuHeight = MENU_HEIGHT_BY_KIND[target.kind] ?? 220
    const x = Math.max(8, Math.min(e.clientX, window.innerWidth  - MENU_WIDTH  - 8))
    const y = Math.max(8, Math.min(e.clientY, window.innerHeight - menuHeight - 8))
    setCtx(target); setCtxPos({ x, y })
  }
  const closeCtx = () => setCtx(null)
  const close    = () => setModal(null)

  const openNewReservation = (barberId: number, slot: number) => {
    if (BREAK_START_SLOT != null && BREAK_END_SLOT != null && slot >= BREAK_START_SLOT && slot < BREAK_END_SLOT) return
    setNewResForm({ barber_id: barberId, data_hora: slotToISO(selectedDate, slot, START_H), status: 'confirmada', sendEmail: true })
    setModal({ type: 'res_new', barberId, slot }); closeCtx()
  }
  const openNewUnavailable = (barberId: number, slot: number) => {
    if (BREAK_START_SLOT != null && BREAK_END_SLOT != null && slot >= BREAK_START_SLOT && slot < BREAK_END_SLOT) return
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
        payload.data_hora_inicio = `${dayStart}T${String(BUSINESS_OPEN_H).padStart(2,'0')}:00:00`
        payload.data_hora_fim    = `${dayEnd}T${String(BUSINESS_CLOSE_H).padStart(2,'0')}:00:00`
      }
      if (isNew || !uForm.id) {
        const conflictsRes = await barbersApi.checkConflicts({
          barber_id:  payload.barbeiro_id!,
          start:      payload.data_hora_inicio!,
          end:        payload.data_hora_fim!,
          is_all_day: !!payload.is_all_day,
          recurrence_type:     (payload as Partial<Unavailable> & { recurrence_end_date?: string }).recurrence_type,
          recurrence_end_date: (payload as Partial<Unavailable> & { recurrence_end_date?: string }).recurrence_end_date,
        })
        if (conflictsRes.success && conflictsRes.data && conflictsRes.data.length > 0) {
          setPendingUForm(payload)
          setConflictReservations(conflictsRes.data)
          setConflictModal(true)
          return
        }
        const response = await barbersApi.createUnavailable(payload as Unavailable)
        if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
      } else {
        const response = await barbersApi.updateUnavailable(uForm.id, payload as Unavailable)
        if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
      }
      qc.invalidateQueries({ queryKey: ['cal-unavail'] }); close()
    } catch (e: unknown) { setUError(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setUSaving(false) }
  }

  const handleCalendarConflictConfirm = async (selectedIds: number[], reason: string) => {
    if (!pendingUForm) return
    setConflictSaving(true)
    try {
      const response = await barbersApi.createUnavailable(pendingUForm as Unavailable)
      if (!response.success) throw new Error(response.error ?? 'Erro ao guardar')
      await Promise.all(
        selectedIds.map(async id => {
          await reservationsApi.update(id, {
            status: 'cancelada',
            nota_privada: `[Cancelamento] ${reason}`,
          })
          await adminApi.post('/api/admin/reservations/cancel-email', {
            reservation_id: id, reason,
          }).catch(() => {})
        })
      )
      qc.invalidateQueries({ queryKey: ['cal-unavail'] })
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      setConflictModal(false)
      setPendingUForm(null)
      setConflictReservations([])
      close()
    } catch (e: unknown) {
      setUError(e instanceof Error ? e.message : 'Erro ao guardar')
      setConflictModal(false)
    } finally {
      setConflictSaving(false)
    }
  }

  const handleCopy = async () => {
    if (modal?.type !== 'res_copy') return
    setCopySaving(true)
    const src = modal.source

    // Calcular lista de datas a criar (recorrência)
    const RECURRENCE_DAYS: Record<string, number> = {
      weekly: 7, biweekly: 14, every3weeks: 21, every4weeks: 28,
    }
    const step = RECURRENCE_DAYS[recurrenceInterval]
    const dates: string[] = [copyDate]
    if (step && recurrenceCount > 1) {
      let cur = copyDate
      for (let i = 1; i < recurrenceCount; i++) {
        const d = new Date(cur + 'T12:00:00')
        d.setDate(d.getDate() + step)
        cur = d.toISOString().slice(0, 10)
        dates.push(cur)
      }
    }

    try {
      await Promise.all(
          dates.map(date =>
              adminApi.post('/api/admin/reservations', {
                client_id:  src.client_id,
                service_id: src.service_id,
                barber_id:  src.barber_id,
                date,
                time:       copyTime,
                notes:      src.comentario ?? '',
                send_email: false,
              })
          )
      )
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      // Repor estado de recorrência para os próximos usos
      setRecurrenceInterval('none')
      setRecurrenceCount(4)
      close()
    } catch {}
  finally { setCopySaving(false) }
  }

  // ── Handler principal: criar nova reserva ────────────────────────────────
  // extraFields é injectado pelo NewReservationForm após decisão do utilizador
  // no modal de email placeholder (atualizar email OU confirmar sem emails).
  const handleSaveNewReservation = async (
    extraFields?: { update_email?: string; send_email?: boolean }
  ) => {
    if (!newResForm.client_id || !newResForm.service_id || !newResForm.barber_id || !newResForm.data_hora) return
    const iso      = newResForm.data_hora as string
    const [date, timeFull] = iso.split('T')
    const time     = (timeFull ?? '').slice(0, 5)

    // send_email: extraFields tem precedência (decisão do modal); se não presente usa o form
    const sendEmail = extraFields?.send_email !== undefined
      ? extraFields.send_email
      : (newResForm.sendEmail ?? false)

    setNewResSaving(true)
    try {
      await adminApi.post('/api/admin/reservations', {
        client_id:        newResForm.client_id,
        service_id:       newResForm.service_id,
        barber_id:        newResForm.barber_id,
        date,
        time,
        notes:            newResForm.comentario ?? '',
        nota_privada:     newResForm.nota_privada ?? '',
        send_email:       sendEmail,
        service_duration: newResForm.service_duration,
        // Campo extra: novo email a persistir no cliente antes de criar a reserva.
        // Apenas presente quando o utilizador escolheu "Atualizar Email" no modal.
        ...(extraFields?.update_email ? { update_email: extraFields.update_email } : {}),
      })
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      close()
    } catch {}
    finally { setNewResSaving(false) }
  }

  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i)
  const dateLabel = useMemo(() => {
    try { return format(parseISO(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return selectedDate }
  }, [selectedDate])

  const resByBarberSlot = useMemo(() => {
    const map = new Map<string, Reservation[]>()

    reservations.forEach(r => {
      if (r.status === 'cancelada') return

      const service = services.find(s => s.id === r.service_id)
      const duration = r.service_duration ?? service?.duration ?? 60

      const start = new Date(r.data_hora)
      const end = addMinutes(start, duration)

      const startMinutes =
          start.getHours() * 60 + start.getMinutes()

      const endMinutes =
          end.getHours() * 60 + end.getMinutes()

      const firstSlot = Math.max(
          0,
          Math.floor((startMinutes - START_H * 60) / SLOT_DURATION),
      )

      // A reserva ocupa todos os slots cujo início é anterior ao seu fim.
      const lastSlotExclusive = Math.ceil(
          (endMinutes - START_H * 60) / SLOT_DURATION,
      )

      for (
          let slot = firstSlot;
          slot < lastSlotExclusive;
          slot++
      ) {
        const key = `${r.barber_id}_${slot}`

        if (!map.has(key)) {
          map.set(key, [])
        }

        const list = map.get(key)!

        if (!list.some(existing => existing.id === r.id)) {
          list.push(r)
        }
      }
    })

    return map
  }, [reservations, services, START_H])

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

  useEffect(() => {
    if (!pendingReservationIdRef.current || !reservations.length) return
    const id = pendingReservationIdRef.current
    const found = reservations.find(r => r.id === id)
    if (found) {
      pendingReservationIdRef.current = null
      setModal({ type: 'res_detail', r: found })
    }
  }, [reservations])

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-3" onClick={closeCtx}>
      <Card padding="xs">
        <div className="flex flex-col gap-3">
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
                className="border border-slate-400 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white
                           focus:outline-none focus:ring-2 focus:ring-brand-400" />
              <select
                className="border border-slate-400 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white min-w-[160px]
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

      {dayConfig.closed ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">🔒</span>
            <p className="text-lg font-semibold text-gray-700">A barbearia está encerrada neste dia</p>
            <p className="text-sm text-gray-500">Seleciona outro dia para ver o calendário.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none" style={{ isolation: 'isolate' }}>
          <div className="overflow-x-auto">
            <div ref={gridRef} className="grid select-none"
              style={{ gridTemplateColumns: `3rem repeat(${barbers.length}, minmax(140px, 1fr))`, minWidth: 3*16 + barbers.length*140 }}>

              <div className="sticky top-0 z-30 bg-white border-b border-gray-100 h-10" />
              {barbers.map(b => (
                <div key={b.id} className="sticky top-0 z-30 h-10 flex items-center justify-center border-b border-l"
                  style={{ background: b.color ?? '#d4a017', borderColor: hexToRgba(b.color ?? '#d4a017', 0.4) }}>
                  <span className="text-sm font-bold text-white drop-shadow-sm">{b.name}</span>
                </div>
              ))}

              {timeSlots.map(slot => {
                const isHourEnd = (slot + 1) % SLOTS_PER_H === 0
                return (
                  <React.Fragment key={slot}>
                    <div
                      className={`flex items-top justify-center ${
                        isHourEnd ? 'border-b-2 border-slate-400' : 'border-b border-slate-200'
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
                      const overlappingList = resByBarberSlot.get(key) ?? []

                      const rList = overlappingList.filter(r => {
                        const reservationStartSlot = timeToSlot(r.data_hora, START_H)
                        return reservationStartSlot === slot
                      })
                      const colBg   = hexToRgba(b.color ?? '#d4a017', 0.1)
                      const isBreakSlot = BREAK_START_SLOT != null && BREAK_END_SLOT != null
                          && slot >= BREAK_START_SLOT && slot < BREAK_END_SLOT

                      const baseCellClasses = isHourEnd
                          ? 'relative border-l border-b-2 border-slate-400'
                          : 'relative border-l border-b border-gray-400'

                      if (!blocked && rList.length === 0) {
                        if (isBreakSlot) {
                          return (
                              <div key={key}
                                   className={`${baseCellClasses}`}
                                   style={{
                                     height: SLOT_H,
                                     backgroundImage: `repeating-linear-gradient(135deg, #e5e7eb 0px, #e5e7eb 3px, #f9fafb 3px, #f9fafb 10px)`,
                                     cursor: 'default',
                                   }}
                                   title="Pausa / Intervalo"
                              />
                          )
                        }
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
                              ? `repeating-linear-gradient(135deg,${hexToRgba(b.color ?? '#d4a017', 0.4)} 0px,${hexToRgba(b.color ?? '#d4a017', 0.4)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.2)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.2)} 12px)`
                              : undefined,
                          }}
                          onClick={blocked ? (e => openCtx(e, { kind: 'unavailable', unavailable: blocked })) : undefined}
                        >
                          {blocked && isFirstBlockedSlot && (
                            <div className="absolute inset-x-1 top-0.5 flex items-center gap-1 z-10">
                              <span className="text-sm leading-none">{TIPO_ICON[blocked.tipo]}</span>
                              <span className="text-[14px] font-bold text-black truncate">
                                {TIPO_LABEL[blocked.tipo]}{blocked.motivo ? ` · ${blocked.motivo}` : ''}
                                {blocked.recurrence_group_id ? ' 🔁' : ''}
                              </span>
                            </div>
                          )}
                          {rList.length > 1 && (
                              <button
                                  type="button"
                                  className="absolute top-0.5 right-1 z-30 bg-red-600 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 shadow"
                                  onClick={e => {
                                    e.stopPropagation()
                                    setOverlapReservations(rList)
                                  }}
                                  title={`${rList.length} reservas neste horário`}
                              >
                                +{rList.length - 1}
                              </button>
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
                                    {shortLabel}{' '}
                                    {r.created_by === 'online' && <span className="text-blue-700 font-bold mr-0.5">@</span>}
                                    {hasMeaningfulReservationComment(r.comentario) && <span className="mr-0.5">💬</span>}
                                    {r.client_name}
                                  </p>
                                ) : (
                                  <>
                                    <p className="text-[13px] font-semibold leading-4 truncate text-black">
                                      {r.created_by === 'online' && <span className="text-blue-700 font-bold mr-0.5">@</span>}
                                      {hasMeaningfulReservationComment(r.comentario) && <span className="mr-0.5">💬</span>}
                                      {r.client_name}
                                    </p>
                                    <p className="text-[12px] leading-4 truncate text-black/90">{r.service_name} - {format(new Date(r.data_hora),'HH:mm')}–{format(addMinutes(new Date(r.data_hora),dur),'HH:mm')}</p>
                                  </>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </Card>
      )}

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
                  <CtxItem
                    icon="🧑"
                    label="Ver cliente"
                    onClick={() => {
                      setModal({
                        type: 'client_detail',
                        clientId: r.client_id,
                        initialClientName: r.client_name,
                        initialClientPhone: r.client_phone,
                        initialClientEmail: r.client_email,
                      })
                      closeCtx()
                    }}
                  />
                )}
                <CtxItem icon="✏️" label="Editar Reserva" onClick={() => { setModal({ type: 'res_edit',   r }); closeCtx() }} />
                <CtxItem icon="📋" label="Copiar Reserva" onClick={() => {
                  setCopyDate(selectedDate)
                  setCopyTime(format(new Date(r.data_hora), 'HH:mm'))
                  setRecurrenceInterval('none')
                  setRecurrenceCount(4)
                  setModal({ type: 'res_copy', source: r })
                  closeCtx()
                }} />
                <div className="border-t border-gray-100 my-1" />
                {r.status === 'concluida' && (
                  <CtxItem icon="💳" label="Editar Pagamento" onClick={() => { setModal({ type: 'res_checkout', r, editMode: true }); closeCtx() }} />
                )}
                {r.status === 'concluida' && (
                    <CtxItem icon="🧾" label="Faturar" onClick={() => { setModal({ type: 'res_checkout', r }); closeCtx() }} />
                )}
                {r.status !== 'concluida' && r.status !== 'cancelada' && r.status !== 'faltou' && (
                  <CtxItem icon="✅" label="Chegou" onClick={() => { setModal({ type: 'res_checkout', r }); closeCtx() }} />
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

      {modal?.type === 'res_detail' && (
        <ReservationDetailModal
          reservation={modal.r}
          onClose={close}
          onEdit={() => setModal({ type: 'res_edit', r: modal.r })}
          onChangeStatus={action => setModal({ type: 'res_status', r: modal.r, action })}
          onCancel={() => setModal({ type: 'res_status', r: modal.r, action: 'cancelada' })}
          onCheckout={() => setModal({ type: 'res_checkout', r: modal.r })}
          onEditPayment={() => setModal({ type: 'res_checkout', r: modal.r, editMode: true })}
        />
      )}

      {modal?.type === 'res_checkout' && (
        <CheckoutModal
          reservation={modal.r}
          invalidateKey="cal-reservations"
          onClose={close}
          editMode={modal.editMode ?? false}
          pendingEditForm={modal.pendingEditForm}
        />
      )}

      {modal?.type === 'res_edit' && (
        <ReservationEditModal
          reservation={modal.r}
          invalidateKey="cal-reservations"
          onClose={close}
          onCancelRequest={() => setModal({ type: 'res_status', r: modal.r, action: 'cancelada' })}
          onOpenCheckout={pendingForm =>
            setModal({ type: 'res_checkout', r: modal.r, pendingEditForm: pendingForm })
          }
        />
      )}

      {modal?.type === 'client_detail' && (
        <ClientDetailModal
          clientId={modal.clientId}
          initialClient={modal.initialClientName ? {
            id: modal.clientId,
            name: modal.initialClientName,
            phone: modal.initialClientPhone,
            email: modal.initialClientEmail,
          } : null}
          onClose={close}
        />
      )}

      {modal?.type === 'res_status' && (
        <ReservationStatusModal
          reservation={modal.r}
          action={modal.action}
          invalidateKey="cal-reservations"
          onClose={close}
        />
      )}

      {overlapReservations && (
          <Modal
              open={true}
              onClose={() => setOverlapReservations(null)}
              title="Reservas neste horário"
          >
            <div className="space-y-2 text-sm">
              {overlapReservations.map(r => (
                  <button
                      key={r.id}
                      type="button"
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-gray-50 flex flex-col"
                      onClick={() => {
                        setModal({ type: 'res_detail', r })
                        setOverlapReservations(null)
                      }}
                  >
          <span className="font-semibold">
            {r.client_name} – {r.service_name}
          </span>
                    <span className="text-xs text-gray-500">
            {format(new Date(r.data_hora), 'HH:mm', { locale: pt })} · {r.barber_name}
          </span>
                  </button>
              ))}
            </div>
          </Modal>
      )}

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
                barberId={modal.source.barber_id ?? 0}
                copyDate={copyDate}
                copyTime={copyTime}
                recurrenceInterval={recurrenceInterval}
                recurrenceCount={recurrenceCount}
                reservations={reservations}
                unavailabilities={unavailable}
                onChange={(field, value) => {
                  if (field === 'copyDate'           && typeof value === 'string')  setCopyDate(value)
                  if (field === 'copyTime'           && typeof value === 'string')  setCopyTime(value)
                  if (field === 'recurrenceInterval' && typeof value === 'string')  setRecurrenceInterval(value)
                  if (field === 'recurrenceCount'    && typeof value === 'number')  setRecurrenceCount(value)
                }}
            />
        ) : <></>}
      </Modal>

      <Modal open={modal?.type === 'res_new'} onClose={close} title="Nova reserva">
        {modal?.type === 'res_new' ? (
          <NewReservationForm
            barberId={modal.barberId}
            slot={modal.slot}
            selectedDate={selectedDate}
            startH={START_H}
            barbers={barbers}
            services={services}
            form={newResForm}
            saving={newResSaving}
            onChange={(k, v) => setNewResForm(f => ({ ...f, [k]: v }))}
            onSave={handleSaveNewReservation}
            onCancel={close}
          />
        ) : <></>}
      </Modal>

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

      <ConflictReservationsModal
        open={conflictModal}
        reservations={conflictReservations}
        saving={conflictSaving}
        onCancel={() => { setConflictModal(false); setPendingUForm(null); setConflictReservations([]) }}
        onConfirm={(selectedIds, reason) => { void handleCalendarConflictConfirm(selectedIds, reason) }}
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
