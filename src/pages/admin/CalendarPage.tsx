import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes, isSunday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { clientsApi } from '@/api/clients'
import { api } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import type { Reservation, Barber, Unavailable, UnavailableTipo, Service } from '@/types'

const SLOT_H  = 48
const START_H = 8
const END_H   = 21
const TOTAL_SLOTS = (END_H - START_H) * 2

const TIPO_ICON: Record<UnavailableTipo, string> = {
  folga: '✈️', ferias: '🏖️', almoco: '🍴', ausencia: '🚫', outro: '📌',
}
const TIPO_LABEL: Record<UnavailableTipo, string> = {
  folga: 'Folga', ferias: 'Férias', almoco: 'Almoço', ausencia: 'Ausência', outro: 'Outro',
}
const STATUS_COLORS: Record<string, string> = {
  confirmada: '#3b82f6', concluida: '#10b981', cancelada: '#ef4444', faltou: '#6b7280',
}
const STATUS_BAR: Record<string, string> = {
  confirmada: '#3b82f6', concluida: '#10b981', faltou: '#ef4444', cancelada: '#9ca3af',
}
const STATUS_LABEL: Record<string, string> = {
  confirmada: 'Confirmada', concluida: 'Concluída', cancelada: 'Cancelada', faltou: 'Não compareceu',
}
const VALID_STATUSES = ['confirmada', 'concluida', 'cancelada', 'faltou'] as const
type ValidStatus = typeof VALID_STATUSES[number]
const TIPO_OPTIONS: UnavailableTipo[] = ['folga', 'ferias', 'almoco', 'ausencia', 'outro']

function timeToSlot(iso: string) {
  const d = new Date(iso)
  return (d.getHours() - START_H) * 2 + (d.getMinutes() >= 30 ? 1 : 0)
}
function slotToLabel(slot: number) {
  const t = START_H * 60 + slot * 30
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '00')}`
}
function slotToISO(dateStr: string, slot: number) {
  const t = START_H * 60 + slot * 30
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

type ModalState =
  | { type: 'reservation_detail';  reservation: Reservation }
  | { type: 'reservation_edit';    reservation: Reservation }
  | { type: 'reservation_copy';    source: Reservation }
  | { type: 'reservation_cancel';  reservation: Reservation }
  | { type: 'reservation_new';     barberId: number; slot: number }
  | { type: 'unavailable_form';    data: Partial<Unavailable>; isNew: boolean }
  | null

// ─── Debounced date input ────────────────────────────────────────────────────
function useDebouncedDate(initial: string, delay = 600) {
  const [display, setDisplay] = useState(initial)
  const [committed, setCommitted] = useState(initial)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onChange = useCallback((val: string) => {
    setDisplay(val)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { if (val) setCommitted(val) }, delay)
  }, [delay])

  // keep display in sync when committed changes externally (prev/next buttons)
  const setDate = useCallback((val: string | ((prev: string) => string)) => {
    if (timer.current) clearTimeout(timer.current)
    if (typeof val === 'function') {
      setCommitted(prev => {
        const next = val(prev)
        setDisplay(next)
        return next
      })
    } else {
      setDisplay(val)
      setCommitted(val)
    }
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { display, committed, onChange, setDate }
}

export default function CalendarPage() {
  const qc = useQueryClient()

  const adminUser = useMemo(() => {
    try { const r = localStorage.getItem('admin_user'); return r ? JSON.parse(r) as { role?: string; barbeiro_id?: number } : null }
    catch { return null }
  }, [])
  const isBarber     = adminUser?.role === 'barbeiro'
  const barberFilter = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null

  const { display: dateDisplay, committed: selectedDate, onChange: onDateInput, setDate: setSelectedDate } =
    useDebouncedDate(format(new Date(), 'yyyy-MM-dd'))

  const [ctx, setCtx]       = useState<ContextTarget | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [modal, setModal]   = useState<ModalState>(null)
  const [uForm, setUForm]   = useState<Partial<Unavailable> & { recurrence_end_date?: string }>({})
  const [uError, setUError] = useState<string | null>(null)
  const [uSaving, setUSaving] = useState(false)
  const [statusSaving, setStatusSaving] = useState<number | null>(null)

  const [cancelReason, setCancelReason] = useState('')
  const [cancelSaving, setCancelSaving] = useState(false)

  const [copyDate, setCopyDate]   = useState('')
  const [copyTime, setCopyTime]   = useState('')
  const [copySaving, setCopySaving] = useState(false)
  const [copyEmail, setCopyEmail] = useState(false)

  const [newResForm, setNewResForm] = useState<Partial<Reservation & { sendEmail: boolean }>>({})
  const [newResSaving, setNewResSaving] = useState(false)

  // edit reservation
  const [editResForm, setEditResForm] = useState<Partial<Reservation & { sendEmail: boolean }>>({})
  const [editResSaving, setEditResSaving] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'], queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'], queryFn: () => api.get<Service[]>('/api/admin/services') })
  const { data: resRes,  isLoading: loadingRes } = useQuery({
    queryKey: ['cal-reservations', selectedDate],
    queryFn:  () => reservationsApi.list({ date: selectedDate, perPage: 200 }),
  })
  const { data: uRes, isLoading: loadingU } = useQuery({
    queryKey: ['cal-unavail', selectedDate],
    queryFn:  () => barbersApi.listUnavailable({ date: selectedDate }),
  })

  const allBarbers: Barber[]       = barbersRes?.data ?? []
  const barbers: Barber[]          = (barberFilter ? allBarbers.filter(b => b.id === barberFilter) : [...allBarbers]).sort((a,b) => a.id - b.id)
  const services: Service[]        = (servicesRes?.data as unknown as Service[]) ?? []
  const reservations: Reservation[] = resRes?.data?.items ?? []
  const unavailable: Unavailable[]  = (uRes?.data as unknown as Unavailable[]) ?? []
  const isLoading = loadingRes || loadingU

  const dateIsSunday = useMemo(() => { try { return isSunday(parseISO(selectedDate)) } catch { return false } }, [selectedDate])

  const changeDate = useCallback((delta: number) => {
    setSelectedDate(prev => {
      const dt = new Date(prev + 'T12:00:00'); dt.setDate(dt.getDate() + delta); return format(dt, 'yyyy-MM-dd')
    })
  }, [setSelectedDate])

  // ... rest of file unchanged
