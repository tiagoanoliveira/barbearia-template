import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes, isSunday } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { clientsApi } from '@/api/clients'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import type { Reservation, Barber, Unavailable, UnavailableTipo, Service } from '@/types'

const SLOT_H  = 40
const START_H = 9
const END_H   = 20
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
  const setDate = useCallback((val: string) => {
    if (timer.current) clearTimeout(timer.current)
    setDisplay(val)
    setCommitted(val)
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
  const { data: servicesRes } = useQuery({ queryKey: ['services'], queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
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
    const dt = new Date(selectedDate + 'T12:00:00')
    dt.setDate(dt.getDate() + delta)
    setSelectedDate(format(dt, 'yyyy-MM-dd'))
  }, [selectedDate, setSelectedDate])

  const openCtx = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault(); e.stopPropagation()
    setCtx(target); setCtxPos({ x: e.clientX, y: e.clientY })
  }
  const closeCtx = () => setCtx(null)

  const openNewReservation = (barberId: number, slot: number) => {
    const iso = slotToISO(selectedDate, slot)
    setNewResForm({ barber_id: barberId, data_hora: iso, status: 'confirmada', sendEmail: true })
    setModal({ type: 'reservation_new', barberId, slot }); closeCtx()
  }
  const openReservationDetail = (r: Reservation) => {
    setModal({ type: 'reservation_detail', reservation: r }); closeCtx()
  }
  const openEditReservation = (r: Reservation) => {
    setEditResForm({ ...r, sendEmail: false })
    setModal({ type: 'reservation_edit', reservation: r }); closeCtx()
  }
  const openCopyReservation = (r: Reservation) => {
    setCopyDate(selectedDate)
    setCopyTime(format(new Date(r.data_hora), 'HH:mm'))
    setCopyEmail(true)
    setModal({ type: 'reservation_copy', source: r }); closeCtx()
  }
  const openCancelReservation = (r: Reservation) => {
    setCancelReason('')
    setModal({ type: 'reservation_cancel', reservation: r }); closeCtx()
  }

  const handleQuickStatus = async (r: Reservation, status: ValidStatus) => {
    if (statusSaving !== null) return
    setStatusSaving(r.id)
    try {
      await reservationsApi.updateStatus(r.id, status as Reservation['status'])
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
    } catch {}
    finally { setStatusSaving(null); closeCtx() }
  }

  const handleCancel = async () => {
    if (modal?.type !== 'reservation_cancel') return
    setCancelSaving(true)
    try {
      await reservationsApi.update(modal.reservation.id, {
        status: 'cancelada',
        nota_privada: cancelReason ? `[Cancelamento] ${cancelReason}` : modal.reservation.nota_privada,
      })
      if (cancelReason) {
        await adminApi.post('/api/admin/reservations/cancel-email', {
          reservation_id: modal.reservation.id, reason: cancelReason,
        }).catch(() => {})
      }
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      setModal(null)
    } catch {}
    finally { setCancelSaving(false) }
  }

  const handleCopy = async () => {
    if (modal?.type !== 'reservation_copy') return
    setCopySaving(true)
    const src = modal.source
    try {
      await reservationsApi.create({
        barber_id: src.barber_id, client_id: src.client_id,
        service_id: src.service_id, data_hora: `${copyDate}T${copyTime}:00`,
        status: 'confirmada', send_email: copyEmail,
      })
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      setModal(null)
    } catch {}
    finally { setCopySaving(false) }
  }

  const handleEditReservation = async () => {
    if (modal?.type !== 'reservation_edit') return
    setEditResSaving(true)
    try {
      await reservationsApi.update(modal.reservation.id, {
        barber_id:    editResForm.barber_id,
        service_id:   editResForm.service_id,
        data_hora:    editResForm.data_hora,
        status:       editResForm.status,
        comentario:   editResForm.comentario,
        nota_privada: editResForm.nota_privada,
        send_email:   editResForm.sendEmail,
      })
      qc.invalidateQueries({ queryKey: ['cal-reservations'] })
      setModal(null)
    } catch {}
    finally { setEditResSaving(false) }
  }

  const openNewUnavailable = (barberId: number, slot: number) => {
    setUForm({ barbeiro_id: barberId, data_hora_inicio: slotToISO(selectedDate, slot),
               data_hora_fim: slotToISO(selectedDate, slot + 2), is_all_day: 0, tipo: 'folga', motivo: '', recurrence_type: 'none' })
    setUError(null)
    setModal({ type: 'unavailable_form', data: {}, isNew: true }); closeCtx()
  }
  const openEditUnavailable = (u: Unavailable) => {
    setUForm({ ...u }); setUError(null)
    setModal({ type: 'unavailable_form', data: u, isNew: false }); closeCtx()
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
      if (isNew || !uForm.id) await barbersApi.createUnavailable(uForm as Unavailable)
      else                    await barbersApi.updateUnavailable(uForm.id, uForm as Unavailable)
      qc.invalidateQueries({ queryKey: ['cal-unavail'] }); setModal(null)
    } catch (e: unknown) { setUError(e instanceof Error ? e.message : 'Erro ao guardar') }
    finally { setUSaving(false) }
  }

  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i)
  const dateLabel = useMemo(() => {
    try { return format(parseISO(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt }) } catch { return selectedDate }
  }, [selectedDate])

  const resByBarberSlot = useMemo(() => {
    const map = new Map<string, Reservation[]>()
    reservations.forEach(r => {
      if (r.status === 'cancelada') return
      const slot = timeToSlot(r.data_hora)
      const key  = `${r.barber_id}_${slot}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(r)
    })
    return map
  }, [reservations])

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
    const slotISO = slotToISO(selectedDate, slot)
    const slotEnd = slotToISO(selectedDate, slot + 1)
    return barberU.find(u => u.data_hora_inicio < slotEnd && u.data_hora_fim > slotISO) ?? null
  }

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-3" onClick={closeCtx}>
      {/* cabeçalho */}
      <Card padding="xs">
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
            <button
              onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
              className="text-xs px-2 py-1 bg-brand-50 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors"
            >Hoje</button>
          </div>
          {/* input de data com debounce — só carrega após 600ms de inatividade */}
          <input
            type="date" value={dateDisplay}
            onChange={e => onDateInput(e.target.value)}
            className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white
                       focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
        </div>
      </Card>

      {dateIsSunday ? (
        <Card>
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">🔒</span>
            <p className="text-lg font-semibold text-gray-700">A barbearia está encerrada ao domingo</p>
            <p className="text-sm text-gray-500">Seleciona outro dia para ver o calendário.</p>
          </div>
        </Card>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <div
              ref={gridRef}
              className="grid select-none"
              style={{ gridTemplateColumns: `3rem repeat(${barbers.length}, minmax(140px, 1fr))`, minWidth: 3*16 + barbers.length*140 }}
            >
              <div className="sticky top-0 z-10 bg-white border-b border-gray-100 h-10" />
              {barbers.map(b => (
                <div key={b.id} className="sticky top-0 z-10 h-10 flex items-center justify-center border-b border-l"
                  style={{ background: b.color ?? '#d4a017', borderColor: hexToRgba(b.color ?? '#d4a017', 0.4) }}>
                  <span className="text-xs font-bold text-white drop-shadow-sm">{b.name}</span>
                </div>
              ))}

              {timeSlots.map(slot => (
                <>
                  <div key={`t_${slot}`} className="border-b border-gray-50 flex items-top justify-center" style={{ height: SLOT_H }}>
                    {slot % 2 === 0 && <span className="text-[11px] text-gray-400">{slotToLabel(slot)}</span>}
                  </div>
                  {barbers.map(b => {
                    const blocked = isSlotBlocked(b.id, slot)
                    const key     = `${b.id}_${slot}`
                    const rList   = resByBarberSlot.get(key) ?? []
                    const colBg   = hexToRgba(b.color ?? '#d4a017', 0.1)

                    if (blocked) {
                      const isFirst = blocked.data_hora_inicio === slotToISO(selectedDate, slot)
                        || (slot === 0 && new Date(blocked.data_hora_inicio) <= new Date(slotToISO(selectedDate, 0)))
                      return (
                        <div key={key} className="relative border-b border-l border-gray-300 cursor-pointer"
                          style={{ height: SLOT_H, backgroundImage: `repeating-linear-gradient(135deg,${hexToRgba(b.color ?? '#d4a017', 0.18)} 0px,${hexToRgba(b.color ?? '#d4a017', 0.18)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 4px,${hexToRgba(b.color ?? '#d4a017', 0.06)} 12px)` }}
                          onClick={e => openCtx(e, { kind: 'unavailable', unavailable: blocked })}>
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
                        <div key={key} className="border-b border-l border-gray-300 hover:brightness-95 transition-all cursor-pointer"
                          style={{ height: SLOT_H, background: colBg }}
                          onClick={e => openCtx(e, { kind: 'slot', barberId: b.id, slot })} />
                      )
                    }

                    return (
                      <div key={key} className="relative border-b border-l border-gray-300" style={{ height: SLOT_H, background: colBg }}>
                        {rList.map(r => {
                          const barColor  = b.color ?? '#888'
                          const dur       = r.service_duration ?? 60
                          const heightPx  = Math.max(SLOT_H, Math.round((dur / 30) * SLOT_H))
                          const barColor2 = STATUS_BAR[r.status] ?? barColor
                          return (
                            <div key={r.id}
                              className="absolute inset-x-0.5 top-0 rounded overflow-hidden cursor-pointer flex flex-col justify-start pl-2.5 pr-1 py-0.5 z-20"
                              style={{ background: hexToRgba(barColor, 0.9), height: heightPx, minHeight: SLOT_H, borderLeft: `4px solid ${barColor2}` }}
                              onClick={e => openCtx(e, { kind: 'reservation', reservation: r })}>
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
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* context menu */}
      {ctx && (
        <div className="fixed z-50 bg-white rounded-xl shadow-2xl border border-gray-100 py-1 min-w-[210px] text-sm"
          style={{ top: ctxPos.y, left: ctxPos.x }}
          onClick={e => e.stopPropagation()}>
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
                <CtxItem icon="👁️" label="Ver Reserva"    onClick={() => openReservationDetail(r)} />
                <CtxItem icon="✏️" label="Editar Reserva"  onClick={() => openEditReservation(r)} />
                <CtxItem icon="📋" label="Copiar Reserva"  onClick={() => openCopyReservation(r)} />
                <div className="border-t border-gray-100 my-1" />
                {r.status !== 'concluida' && (
                  <CtxItem icon="✅" label="Chegou" onClick={() => handleQuickStatus(r, 'concluida')} loading={statusSaving === r.id} />
                )}
                {r.status !== 'faltou' && (
                  <CtxItem icon="👤" label="Faltou" onClick={() => handleQuickStatus(r, 'faltou')} loading={statusSaving === r.id} />
                )}
                <CtxItem icon="❌" label="Cancelar Reserva" onClick={() => openCancelReservation(r)} className="text-red-600" />
              </>
            )
          })()}
          {ctx.kind === 'unavailable' && (
            <>
              <CtxItem icon="✏️" label="Editar" onClick={() => openEditUnavailable(ctx.unavailable)} />
              <CtxItem icon="🗑️" label="Eliminar" onClick={() => handleDeleteUnavailable(ctx.unavailable)} className="text-red-600" />
              {ctx.unavailable.recurrence_group_id && (
                <p className="px-4 py-1 text-[10px] text-gray-400 italic">Recorrência – edita o grupo na página de indisponibilidades</p>
              )}
            </>
          )}
        </div>
      )}

      {/* modal detalhe */}
      <Modal open={modal?.type === 'reservation_detail'} onClose={() => setModal(null)} title="Detalhe da reserva">
        {modal?.type === 'reservation_detail' ? (
          <ReservationDetail r={modal.reservation}
            onStatusChange={s => handleQuickStatus(modal.reservation, s)}
            onEdit={() => openEditReservation(modal.reservation)}
            onCancel={() => { setModal(null); openCancelReservation(modal.reservation) }} />
        ) : <></>}
      </Modal>

      {/* modal editar reserva */}
      <Modal
        open={modal?.type === 'reservation_edit'}
        onClose={() => setModal(null)}
        title="Editar reserva"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={handleEditReservation} disabled={editResSaving}>
              {editResSaving ? 'A guardar...' : 'Guardar'}
            </button>
          </>
        }
      >
        {modal?.type === 'reservation_edit' ? (
          <EditReservationForm
            form={editResForm}
            barbers={barbers}
            services={services}
            onChange={(k, v) => setEditResForm(f => ({ ...f, [k]: v }))}
          />
        ) : <></>}
      </Modal>

      {/* modal cancelar */}
      <Modal open={modal?.type === 'reservation_cancel'} onClose={() => setModal(null)} title="Cancelar reserva"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Voltar</button>
            <button className="btn-danger" onClick={handleCancel} disabled={cancelSaving}>
              {cancelSaving ? 'A cancelar...' : 'Confirmar cancelamento'}
            </button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Opcional: indica o motivo do cancelamento. O cliente receberá um email com essa informação.</p>
          <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
            placeholder="Ex.: Barbeiro indisponível por motivo de saúde"
            className="input text-sm w-full resize-none" />
        </div>
      </Modal>

      {/* modal copiar */}
      <Modal open={modal?.type === 'reservation_copy'} onClose={() => setModal(null)} title="Copiar reserva"
        footer={
          <>
            <button className="btn-secondary" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={handleCopy} disabled={copySaving}>
              {copySaving ? 'A criar...' : 'Criar reserva'}
            </button>
          </>
        }>
        {modal?.type === 'reservation_copy' ? (
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

      {/* modal nova reserva */}
      <Modal open={modal?.type === 'reservation_new'} onClose={() => setModal(null)} title="Nova reserva">
        {modal?.type === 'reservation_new' ? (
          <NewReservationForm
            barberId={modal.barberId} slot={modal.slot}
            selectedDate={selectedDate} barbers={barbers} services={services}
            form={newResForm} saving={newResSaving}
            onChange={(k, v) => setNewResForm(f => ({ ...f, [k]: v }))}
            onSave={async () => {
              setNewResSaving(true)
              try {
                await reservationsApi.create(newResForm)
                qc.invalidateQueries({ queryKey: ['cal-reservations'] })
                setModal(null)
              } catch {}
              finally { setNewResSaving(false) }
            }}
            onCancel={() => setModal(null)}
          />
        ) : <></>}
      </Modal>

      {/* modal indisponibilidade */}
      <Modal open={modal?.type === 'unavailable_form'} onClose={() => setModal(null)}
        title={modal?.type === 'unavailable_form' && modal.isNew ? 'Nova indisponibilidade' : 'Editar indisponibilidade'}>
        {modal?.type === 'unavailable_form' ? (
          <UnavailableForm form={uForm} barbers={barbers} isNew={modal.isNew}
            error={uError} saving={uSaving}
            onChange={(k, v) => setUForm(f => ({ ...f, [k]: v }))}
            onSave={handleSaveUnavailable} onCancel={() => setModal(null)} />
        ) : <></>}
      </Modal>
    </div>
  )
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────
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

function ReservationDetail({ r, onStatusChange, onEdit, onCancel }: {
  r: Reservation; onStatusChange: (s: ValidStatus) => void; onEdit: () => void; onCancel: () => void
}) {
  const dt    = new Date(r.data_hora)
  const endDt = addMinutes(dt, r.service_duration ?? 60)
  return (
    <div className="space-y-3 text-sm">
      <Row label="Cliente"  value={r.client_name} />
      {r.client_phone && <Row label="Telefone" value={<a href={`tel:${r.client_phone}`} className="text-brand-600">{r.client_phone}</a>} />}
      <Row label="Serviço"  value={r.service_name} />
      <Row label="Horário"  value={`${format(dt,'HH:mm')} – ${format(endDt,'HH:mm')}`} />
      <Row label="Estado"   value={
        <span className="text-xs px-2 py-1 rounded-full text-white font-medium" style={{ background: STATUS_COLORS[r.status] ?? '#888' }}>
          {STATUS_LABEL[r.status] ?? r.status}
        </span>
      } />
      {r.comentario   && <NoteBox label="Notas do cliente" text={r.comentario}   bg="gray" />}
      {r.nota_privada && <NoteBox label="Nota privada"     text={r.nota_privada} bg="amber" />}
      <div className="border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-500 mb-2">Alterar estado:</p>
        <div className="flex flex-wrap gap-2">
          {VALID_STATUSES.filter(s => s !== r.status && s !== 'cancelada').map(s => (
            <button key={s} onClick={() => onStatusChange(s)}
              className="text-xs px-3 py-1.5 rounded-full text-white font-medium hover:opacity-80"
              style={{ background: STATUS_COLORS[s] }}>{STATUS_LABEL[s]}</button>
          ))}
          <button onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-600 font-medium hover:bg-blue-200"
          >✏️ Editar</button>
          <button onClick={onCancel}
            className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-600 font-medium hover:bg-red-200"
          >Cancelar reserva</button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
function NoteBox({ label, text, bg }: { label: string; text: string; bg: 'gray' | 'amber' }) {
  return (
    <div>
      <p className="text-gray-500 mb-1">{label}</p>
      <p className={`text-xs rounded-lg px-3 py-2 ${ bg === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700' }`}>{text}</p>
    </div>
  )
}

// ─── Client search with debounce ──────────────────────────────────────────────
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
            <li key={c.id}
              className="px-3 py-2 text-sm hover:bg-gray-50 cursor-pointer flex justify-between"
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

// ─── Nova reserva ─────────────────────────────────────────────────────────────
function NewReservationForm({ barberId, slot, selectedDate, barbers, services, form, saving, onChange, onSave, onCancel }: {
  barberId: number; slot: number; selectedDate: string; barbers: Barber[]; services: Service[]
  form: Partial<Reservation & { sendEmail: boolean }>
  saving: boolean
  onChange: (k: string, v: unknown) => void
  onSave: () => void; onCancel: () => void
}) {
  const iso = slotToISO(selectedDate, slot)
  return (
    <div className="space-y-3 text-sm">
      {/* Cliente */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Cliente <span className="text-red-400">*</span></label>
        <ClientSearch value={form.client_id} onChange={(id, name) => { onChange('client_id', id); onChange('client_name', name) }} />
      </div>
      {/* Barbeiro */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
        <select value={form.barber_id ?? barberId} onChange={e => onChange('barber_id', Number(e.target.value))} className="input text-sm w-full">
          {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {/* Serviço */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Serviço <span className="text-red-400">*</span></label>
        <select value={form.service_id ?? ''} onChange={e => onChange('service_id', Number(e.target.value))} className="input text-sm w-full">
          <option value="">Selecionar serviço</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
        </select>
      </div>
      {/* Data/hora */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
        <input type="datetime-local" value={(form.data_hora ?? iso).substring(0,16)}
          onChange={e => onChange('data_hora', e.target.value + ':00')}
          className="input text-sm w-full" />
      </div>
      {/* Nota */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nota (opcional)</label>
        <textarea rows={2} value={form.comentario ?? ''} onChange={e => onChange('comentario', e.target.value)}
          placeholder="Observações para o barbeiro..."
          className="input text-sm w-full resize-none" />
      </div>
      {/* Email */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!form.sendEmail} onChange={e => onChange('sendEmail', e.target.checked)} />
        <span>Enviar email de confirmação ao cliente</span>
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="btn-secondary text-xs">Cancelar</button>
        <button onClick={onSave} disabled={saving || !form.client_id || !form.service_id}
          className="btn-primary text-xs disabled:opacity-50">
          {saving ? 'A criar...' : 'Criar reserva'}
        </button>
      </div>
    </div>
  )
}

// ─── Editar reserva ───────────────────────────────────────────────────────────
function EditReservationForm({ form, barbers, services, onChange }: {
  form: Partial<Reservation & { sendEmail: boolean }>
  barbers: Barber[]; services: Service[]
  onChange: (k: string, v: unknown) => void
}) {
  return (
    <div className="space-y-3 text-sm">
      {/* Cliente (só visualização) */}
      <div className="bg-gray-50 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
        <p className="font-medium">{form.client_name}</p>
      </div>
      {/* Barbeiro */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
        <select value={form.barber_id ?? ''} onChange={e => onChange('barber_id', Number(e.target.value))} className="input text-sm w-full">
          {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>
      {/* Serviço */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Serviço</label>
        <select value={form.service_id ?? ''} onChange={e => onChange('service_id', Number(e.target.value))} className="input text-sm w-full">
          <option value="">Selecionar serviço</option>
          {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
        </select>
      </div>
      {/* Data/hora */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
        <input type="datetime-local" value={(form.data_hora ?? '').substring(0,16)}
          onChange={e => onChange('data_hora', e.target.value + ':00')}
          className="input text-sm w-full" />
      </div>
      {/* Estado */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Estado</label>
        <select value={form.status ?? 'confirmada'} onChange={e => onChange('status', e.target.value)} className="input text-sm w-full">
          {VALID_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>
      {/* Nota do cliente */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nota do cliente</label>
        <textarea rows={2} value={form.comentario ?? ''} onChange={e => onChange('comentario', e.target.value)}
          className="input text-sm w-full resize-none" />
      </div>
      {/* Nota privada */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">Nota privada</label>
        <textarea rows={2} value={form.nota_privada ?? ''} onChange={e => onChange('nota_privada', e.target.value)}
          className="input text-sm w-full resize-none" />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={!!form.sendEmail} onChange={e => onChange('sendEmail', e.target.checked)} />
        <span>Reenviar email de confirmação ao cliente</span>
      </label>
    </div>
  )
}

// ─── Indisponibilidade ────────────────────────────────────────────────────────
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
        <input type="text" value={form.motivo ?? ''} onChange={e => onChange('motivo', e.target.value)}
          placeholder="Ex.: consulta médica" className="input text-sm w-full" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="iad" checked={!!form.is_all_day} onChange={e => onChange('is_all_day', e.target.checked ? 1 : 0)} />
        <label htmlFor="iad" className="text-xs text-gray-600">Dia inteiro</label>
      </div>
      {form.is_all_day ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input type="date" value={form.data_hora_inicio?.substring(0,10)??''}
              onChange={e => onChange('data_hora_inicio', e.target.value+'T00:00:00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input type="date" value={form.data_hora_fim?.substring(0,10)??''}
              onChange={e => onChange('data_hora_fim', e.target.value+'T23:59:00')} className="input text-xs w-full" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_inicio)}
              onChange={e => onChange('data_hora_inicio', e.target.value+':00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_fim)}
              onChange={e => onChange('data_hora_fim', e.target.value+':00')} className="input text-xs w-full" />
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
              <input type="date" value={form.recurrence_end_date??''}
                onChange={e => onChange('recurrence_end_date', e.target.value)} className="input text-xs w-full" />
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
