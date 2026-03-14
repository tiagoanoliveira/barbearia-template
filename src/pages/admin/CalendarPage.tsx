import { useRef, useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addMinutes } from 'date-fns'
import { pt } from 'date-fns/locale'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import Modal from '@/components/ui/Modal'
import type { Reservation, Barber, Unavailable, UnavailableTipo } from '@/types'

const SLOT_H  = 48
const START_H = 8
const END_H   = 21
const TOTAL_SLOTS = (END_H - START_H) * 2

const TIPO_ICON: Record<UnavailableTipo, string> = {
  folga:    '✈️',
  ferias:   '🏖️',
  almoco:   '🍴',
  ausencia: '🚫',
  outro:    '📌',
}
const TIPO_LABEL: Record<UnavailableTipo, string> = {
  folga:    'Folga',
  ferias:   'Férias',
  almoco:   'Almoço',
  ausencia: 'Ausência',
  outro:    'Outro',
}

const STATUS_COLORS: Record<string, string> = {
  pendente:   '#f59e0b',
  confirmada: '#3b82f6',
  concluida:  '#10b981',
  cancelada:  '#ef4444',
  faltou:     '#6b7280',
}

const STATUS_LABEL: Record<string, string> = {
  pendente:   'Pendente',
  confirmada: 'Confirmada',
  concluida:  'Concluída',
  cancelada:  'Cancelada',
  faltou:     'Não compareceu',
}

function timeToSlot(iso: string): number {
  const d = new Date(iso)
  return (d.getHours() - START_H) * 2 + (d.getMinutes() >= 30 ? 1 : 0)
}

function slotToLabel(slot: number): string {
  const totalMin = START_H * 60 + slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function slotToISO(dateStr: string, slot: number): string {
  const totalMin = START_H * 60 + slot * 30
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`
}

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

type ContextTarget =
  | { kind: 'slot';         barberId: number; slot: number }
  | { kind: 'reservation';  reservation: Reservation }
  | { kind: 'unavailable';  unavailable: Unavailable }

type ModalState =
  | { type: 'reservation_detail'; reservation: Reservation }
  | { type: 'reservation_status'; reservation: Reservation }
  | { type: 'unavailable_form';   data: Partial<Unavailable>; isNew: boolean }
  | { type: 'unavailable_group';  unavailable: Unavailable }
  | null

const TIPO_OPTIONS: UnavailableTipo[] = ['folga', 'ferias', 'almoco', 'ausencia', 'outro']
const VALID_STATUSES = ['pendente', 'confirmada', 'concluida', 'cancelada', 'faltou']

export default function CalendarPage() {
  const qc = useQueryClient()

  const adminUser = useMemo(() => {
    try {
      const raw = localStorage.getItem('admin_user')
      return raw ? JSON.parse(raw) as { role?: string; barbeiro_id?: number } : null
    } catch { return null }
  }, [])

  const isBarber     = adminUser?.role === 'barbeiro'
  const barberFilter = isBarber && adminUser.barbeiro_id ? adminUser.barbeiro_id : null

  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [ctx, setCtx]       = useState<ContextTarget | null>(null)
  const [ctxPos, setCtxPos] = useState({ x: 0, y: 0 })
  const [modal, setModal]   = useState<ModalState>(null)
  const [uForm, setUForm]   = useState<Partial<Unavailable> & { recurrence_end_date?: string }>({})
  const [uError, setUError] = useState<string | null>(null)
  const [uSaving, setUSaving]         = useState(false)
  const [newStatus, setNewStatus]     = useState('')
  const [statusSaving, setStatusSaving] = useState(false)

  const gridRef = useRef<HTMLDivElement>(null)

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'], queryFn: () => barbersApi.list() })
  const { data: resRes, isLoading: loadingRes } = useQuery({
    queryKey: ['cal-reservations', selectedDate],
    queryFn:  () => reservationsApi.list({ date: selectedDate, perPage: 200 }),
  })
  const { data: uRes, isLoading: loadingU } = useQuery({
    queryKey: ['cal-unavail', selectedDate],
    queryFn:  () => barbersApi.listUnavailable({ date: selectedDate }),
  })

  const allBarbers: Barber[]         = barbersRes?.data ?? []
  const barbers: Barber[]            = barberFilter ? allBarbers.filter(b => b.id === barberFilter) : allBarbers
  const reservations: Reservation[]  = resRes?.data?.items ?? []
  const unavailable: Unavailable[]   = (uRes?.data as unknown as Unavailable[]) ?? []
  const isLoading = loadingRes || loadingU

  const changeDate = useCallback((delta: number) => {
    setSelectedDate(d => {
      const dt = new Date(d + 'T12:00:00')
      dt.setDate(dt.getDate() + delta)
      return format(dt, 'yyyy-MM-dd')
    })
  }, [])

  const openCtx = (e: React.MouseEvent, target: ContextTarget) => {
    e.preventDefault(); e.stopPropagation()
    setCtx(target)
    setCtxPos({ x: e.clientX, y: e.clientY })
  }
  const closeCtx = () => setCtx(null)

  const openNewReservation = (barberId: number, slot: number) => {
    const iso = slotToISO(selectedDate, slot)
    alert(`TODO: abrir modal nova reserva para barbeiro ${barberId} às ${iso.substring(11, 16)}`)
    closeCtx()
  }

  const openReservationDetail = (r: Reservation) => {
    setModal({ type: 'reservation_detail', reservation: r }); closeCtx()
  }

  const openStatusChange = (r: Reservation) => {
    setNewStatus(r.status)
    setModal({ type: 'reservation_status', reservation: r }); closeCtx()
  }

  const openNewUnavailable = (barberId: number, slot: number) => {
    const startISO = slotToISO(selectedDate, slot)
    const endISO   = slotToISO(selectedDate, slot + 2)
    setUForm({ barbeiro_id: barberId, data_hora_inicio: startISO, data_hora_fim: endISO,
               is_all_day: 0, tipo: 'folga', motivo: '', recurrence_type: 'none' })
    setUError(null)
    setModal({ type: 'unavailable_form', data: {}, isNew: true }); closeCtx()
  }

  const openEditUnavailable = (u: Unavailable) => {
    setUForm({ ...u }); setUError(null)
    setModal(u.recurrence_group_id
      ? { type: 'unavailable_group', unavailable: u }
      : { type: 'unavailable_form',  data: u, isNew: false }
    ); closeCtx()
  }

  const handleDeleteUnavailable = async (u: Unavailable, deleteGroup = false) => {
    if (!window.confirm(deleteGroup
      ? `Eliminar todas as ocorrências deste grupo (${TIPO_LABEL[u.tipo]})?`
      : `Eliminar esta indisponibilidade (${TIPO_LABEL[u.tipo]})?`
    )) return
    try {
      await barbersApi.deleteUnavailable(u.id, { group: deleteGroup })
      qc.invalidateQueries({ queryKey: ['cal-unavail'] })
      closeCtx()
    } catch {}
  }

  const handleSaveUnavailable = async () => {
    if (!uForm.barbeiro_id)       { setUError('Barbeiro obrigatório'); return }
    if (!uForm.data_hora_inicio)  { setUError('Data de início obrigatória'); return }
    if (!uForm.data_hora_fim)     { setUError('Data de fim obrigatória'); return }
    if (uForm.data_hora_fim <= uForm.data_hora_inicio) { setUError('Data de fim deve ser posterior ao início'); return }
    setUSaving(true); setUError(null)
    try {
      const isNew = modal && 'isNew' in modal ? modal.isNew : false
      if (isNew || !uForm.id) await barbersApi.createUnavailable(uForm as Unavailable)
      else                    await barbersApi.updateUnavailable(uForm.id, uForm as Unavailable)
      qc.invalidateQueries({ queryKey: ['cal-unavail'] }); setModal(null)
    } catch (e: any) { setUError(e.message ?? 'Erro ao guardar') }
    finally { setUSaving(false) }
  }

  const handleSaveGroupUnavailable = async () => {
    if (!uForm.recurrence_group_id) return
    setUSaving(true); setUError(null)
    try {
      await barbersApi.updateGroup(uForm.recurrence_group_id, { type: uForm.tipo, reason: uForm.motivo })
      qc.invalidateQueries({ queryKey: ['cal-unavail'] }); setModal(null)
    } catch (e: any) { setUError(e.message ?? 'Erro ao guardar grupo') }
    finally { setUSaving(false) }
  }

  const handleSaveStatus = async () => {
    if (modal?.type !== 'reservation_status') return
    setStatusSaving(true)
    try {
      await reservationsApi.updateStatus(modal.reservation.id, newStatus as Reservation['status'])
      qc.invalidateQueries({ queryKey: ['cal-reservations'] }); setModal(null)
    } catch {} finally { setStatusSaving(false) }
  }

  const timeSlots = Array.from({ length: TOTAL_SLOTS }, (_, i) => i)

  const dateLabel = useMemo(() => {
    try { return format(parseISO(selectedDate), "EEEE, d 'de' MMMM 'de' yyyy", { locale: pt }) }
    catch { return selectedDate }
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
      <Card padding="sm">
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
          <div className="flex items-center gap-3">
            <input
              type="date" value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-700 bg-white
                         focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
            <div className="flex items-center gap-3">
              {barbers.map(b => (
                <div key={b.id} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: b.color ?? '#888' }} />
                  <span className="text-xs text-gray-600">{b.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* grid */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <div
            ref={gridRef}
            className="grid select-none"
            style={{
              gridTemplateColumns: `3rem repeat(${barbers.length}, minmax(140px, 1fr))`,
              minWidth: 3 * 16 + barbers.length * 140,
            }}
          >
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100 h-10" />
            {barbers.map(b => (
              <div
                key={b.id}
                className="sticky top-0 z-10 h-10 flex items-center justify-center border-b border-l border-gray-100"
                style={{ background: hexToRgba(b.color ?? '#d4a017', 0.12) }}
              >
                <span className="text-xs font-semibold text-gray-800">{b.name}</span>
              </div>
            ))}

            {timeSlots.map(slot => (
              <>
                <div
                  key={`t_${slot}`}
                  className="border-b border-gray-50 flex items-center justify-end pr-2"
                  style={{ height: SLOT_H }}
                >
                  {slot % 2 === 0 && <span className="text-[10px] text-gray-400">{slotToLabel(slot)}</span>}
                </div>

                {barbers.map(b => {
                  const blocked = isSlotBlocked(b.id, slot)
                  const key     = `${b.id}_${slot}`
                  const rList   = resByBarberSlot.get(key) ?? []

                  if (blocked) {
                    const isFirst = blocked.data_hora_inicio === slotToISO(selectedDate, slot)
                      || (slot === 0 && new Date(blocked.data_hora_inicio) <= new Date(slotToISO(selectedDate, 0)))
                    return (
                      <div
                        key={key}
                        className="relative border-b border-l border-gray-100 cursor-pointer"
                        style={{
                          height: SLOT_H,
                          background: hexToRgba(b.color ?? '#d4a017', 0.08),
                          backgroundImage: `repeating-linear-gradient(135deg,
                            ${hexToRgba(b.color ?? '#d4a017', 0.12)} 0px,
                            ${hexToRgba(b.color ?? '#d4a017', 0.12)} 4px,
                            transparent 4px, transparent 12px)`,
                        }}
                        onClick={e => openCtx(e, { kind: 'unavailable', unavailable: blocked })}
                      >
                        {isFirst && (
                          <div className="absolute inset-x-1 top-0.5 flex items-center gap-1 z-10">
                            <span className="text-base leading-none">{TIPO_ICON[blocked.tipo]}</span>
                            <span className="text-[10px] font-medium text-gray-600 truncate">
                              {TIPO_LABEL[blocked.tipo]}{blocked.motivo ? ` · ${blocked.motivo}` : ''}
                            </span>
                          </div>
                        )}
                      </div>
                    )
                  }

                  if (rList.length === 0) {
                    return (
                      <div
                        key={key}
                        className="border-b border-l border-gray-100 hover:bg-brand-50/40 transition-colors cursor-pointer"
                        style={{ height: SLOT_H }}
                        onClick={e => openCtx(e, { kind: 'slot', barberId: b.id, slot })}
                      />
                    )
                  }

                  return (
                    <div key={key} className="relative border-b border-l border-gray-100" style={{ height: SLOT_H }}>
                      {rList.map(r => {
                        const color    = b.color ?? STATUS_COLORS[r.status] ?? '#888'
                        const dur      = r.service_duration ?? 60
                        const heightPx = Math.max(SLOT_H, Math.round((dur / 30) * SLOT_H))
                        return (
                          <div
                            key={r.id}
                            className="absolute inset-x-0.5 top-0 rounded overflow-hidden cursor-pointer text-white
                                       flex flex-col justify-start px-1 py-0.5 z-20"
                            style={{ background: color, height: heightPx, minHeight: SLOT_H }}
                            onClick={e => openCtx(e, { kind: 'reservation', reservation: r })}
                          >
                            <p className="text-[10px] font-semibold leading-tight truncate">{r.client_name}</p>
                            <p className="text-[9px] leading-tight truncate opacity-90">{r.service_name}</p>
                            {heightPx > SLOT_H && (
                              <p className="text-[9px] leading-tight opacity-70">
                                {format(new Date(r.data_hora), 'HH:mm')}–
                                {format(addMinutes(new Date(r.data_hora), dur), 'HH:mm')}
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

      {/* context menu */}
      {ctx && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[180px] text-sm"
          style={{ top: ctxPos.y, left: ctxPos.x }}
          onClick={e => e.stopPropagation()}
        >
          {ctx.kind === 'slot' && (
            <>
              <CtxItem label="📅 Nova reserva"        onClick={() => openNewReservation(ctx.barberId, ctx.slot)} />
              <CtxItem label="🚫 Marcar indisponível" onClick={() => openNewUnavailable(ctx.barberId, ctx.slot)} />
            </>
          )}
          {ctx.kind === 'reservation' && (
            <>
              <CtxItem label="👁️ Ver detalhes"   onClick={() => openReservationDetail(ctx.reservation)} />
              <CtxItem label="🔄 Alterar estado" onClick={() => openStatusChange(ctx.reservation)} />
            </>
          )}
          {ctx.kind === 'unavailable' && (
            <>
              <CtxItem label="✏️ Editar indisponibilidade" onClick={() => openEditUnavailable(ctx.unavailable)} />
              <CtxItem label="🗑️ Eliminar esta"            onClick={() => handleDeleteUnavailable(ctx.unavailable, false)} className="text-red-600" />
              {ctx.unavailable.recurrence_group_id && (
                <CtxItem label="🗑️ Eliminar grupo inteiro"  onClick={() => handleDeleteUnavailable(ctx.unavailable, true)} className="text-red-700 font-medium" />
              )}
            </>
          )}
        </div>
      )}

      {/* modal detalhe reserva */}
      <Modal
        open={modal?.type === 'reservation_detail'}
        onClose={() => setModal(null)}
        title="Detalhe da reserva"
      >
        {modal?.type === 'reservation_detail' ? (
          <ReservationDetail r={modal.reservation} onStatusClick={() => openStatusChange(modal.reservation)} />
        ) : <></>}
      </Modal>

      {/* modal alterar estado */}
      <Modal
        open={modal?.type === 'reservation_status'}
        onClose={() => setModal(null)}
        title="Alterar estado"
      >
        {modal?.type === 'reservation_status' ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              {modal.reservation.client_name} · {modal.reservation.service_name}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {VALID_STATUSES.map(s => (
                <button
                  key={s}
                  onClick={() => setNewStatus(s)}
                  className={`py-2 rounded-xl text-xs font-medium border transition-all ${
                    newStatus === s ? 'border-transparent text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                  style={newStatus === s ? { background: STATUS_COLORS[s] } : {}}
                >{STATUS_LABEL[s]}</button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal(null)} className="btn-secondary text-xs">Cancelar</button>
              <button
                onClick={handleSaveStatus}
                disabled={statusSaving || newStatus === modal.reservation.status}
                className="btn-primary text-xs disabled:opacity-50"
              >{statusSaving ? 'A guardar...' : 'Guardar'}</button>
            </div>
          </>
        ) : <></>}
      </Modal>

      {/* modal indisponibilidade (criar / editar singular) */}
      <Modal
        open={modal?.type === 'unavailable_form'}
        onClose={() => setModal(null)}
        title={modal?.type === 'unavailable_form' && modal.isNew ? 'Nova indisponibilidade' : 'Editar indisponibilidade'}
      >
        {modal?.type === 'unavailable_form' ? (
          <UnavailableForm
            form={uForm}
            barbers={barbers}
            isNew={modal.isNew}
            error={uError}
            saving={uSaving}
            onChange={(k, v) => setUForm(f => ({ ...f, [k]: v }))}
            onSave={handleSaveUnavailable}
            onCancel={() => setModal(null)}
          />
        ) : <></>}
      </Modal>

      {/* modal grupo indisponibilidade */}
      <Modal
        open={modal?.type === 'unavailable_group'}
        onClose={() => setModal(null)}
        title="Editar grupo de indisponibilidades"
      >
        {modal?.type === 'unavailable_group' ? (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Faz parte de uma recorrência ({uForm.recurrence_type}). Escolhe o que pretendes editar.
            </p>
            <div className="flex flex-col gap-2 mb-4">
              <button
                className="btn-secondary text-sm"
                onClick={() => setModal({ type: 'unavailable_form', data: uForm as Unavailable, isNew: false })}
              >✏️ Editar apenas esta ocorrência</button>
              <button
                className="btn-primary text-sm"
                onClick={handleSaveGroupUnavailable}
              >🔁 Aplicar tipo/motivo a todo o grupo</button>
            </div>
            {uForm.tipo !== undefined && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                  <select
                    value={uForm.tipo ?? 'folga'}
                    onChange={e => setUForm(f => ({ ...f, tipo: e.target.value as UnavailableTipo }))}
                    className="input text-sm w-full"
                  >
                    {TIPO_OPTIONS.map(t => <option key={t} value={t}>{TIPO_ICON[t]} {TIPO_LABEL[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo</label>
                  <input
                    type="text"
                    value={uForm.motivo ?? ''}
                    onChange={e => setUForm(f => ({ ...f, motivo: e.target.value }))}
                    className="input text-sm w-full"
                  />
                </div>
              </div>
            )}
            {uError && <p className="text-xs text-red-500 mt-2">{uError}</p>}
            <div className="flex justify-end mt-3">
              <button onClick={() => setModal(null)} className="btn-secondary text-xs">Fechar</button>
            </div>
          </>
        ) : <></>}
      </Modal>
    </div>
  )
}

function CtxItem({ label, onClick, className = '' }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button className={`w-full text-left px-4 py-2 hover:bg-gray-50 transition-colors ${className}`} onClick={onClick}>
      {label}
    </button>
  )
}

function ReservationDetail({ r, onStatusClick }: { r: Reservation; onStatusClick: () => void }) {
  const dt    = new Date(r.data_hora)
  const endDt = addMinutes(dt, r.service_duration ?? 60)
  return (
    <div className="space-y-3 text-sm">
      <Row label="Cliente"  value={r.client_name} />
      {r.client_phone && <Row label="Telefone" value={<a href={`tel:${r.client_phone}`} className="text-brand-600">{r.client_phone}</a>} />}
      <Row label="Serviço"  value={r.service_name} />
      <Row label="Horário"  value={`${format(dt,'HH:mm')} – ${format(endDt,'HH:mm')}`} />
      <Row label="Estado"   value={
        <button onClick={onStatusClick} className="text-xs px-2 py-1 rounded-full text-white font-medium"
          style={{ background: STATUS_COLORS[r.status] ?? '#888' }}>
          {STATUS_LABEL[r.status]}
        </button>
      } />
      {r.comentario  && <NoteBox label="Notas do cliente" text={r.comentario}  bg="gray" />}
      {r.nota_privada && <NoteBox label="Nota privada"     text={r.nota_privada} bg="amber" />}
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
      <p className={`text-xs rounded-lg px-3 py-2 ${
        bg === 'amber' ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-gray-700'
      }`}>{text}</p>
    </div>
  )
}

interface UnavailableFormProps {
  form:     Partial<Unavailable> & { recurrence_end_date?: string }
  barbers:  Barber[]
  isNew:    boolean
  error:    string | null
  saving:   boolean
  onChange: (k: string, v: unknown) => void
  onSave:   () => void
  onCancel: () => void
}

function UnavailableForm({ form, barbers, isNew, error, saving, onChange, onSave, onCancel }: UnavailableFormProps) {
  const fmtLocal = (iso?: string) => iso ? iso.substring(0, 16) : ''
  return (
    <div className="space-y-3">
      {isNew && (
        <div>
          <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
          <select value={form.barbeiro_id ?? ''} onChange={e => onChange('barbeiro_id', Number(e.target.value))}
            className="input text-sm w-full">
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
        <input type="checkbox" id="is_all_day" checked={!!form.is_all_day}
          onChange={e => onChange('is_all_day', e.target.checked ? 1 : 0)} />
        <label htmlFor="is_all_day" className="text-xs text-gray-600">Dia inteiro</label>
      </div>
      {form.is_all_day ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data início</label>
            <input type="date" value={form.data_hora_inicio?.substring(0, 10) ?? ''}
              onChange={e => onChange('data_hora_inicio', e.target.value + 'T00:00:00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data fim</label>
            <input type="date" value={form.data_hora_fim?.substring(0, 10) ?? ''}
              onChange={e => onChange('data_hora_fim', e.target.value + 'T23:59:00')} className="input text-xs w-full" />
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Início</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_inicio)}
              onChange={e => onChange('data_hora_inicio', e.target.value + ':00')} className="input text-xs w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Fim</label>
            <input type="datetime-local" value={fmtLocal(form.data_hora_fim)}
              onChange={e => onChange('data_hora_fim', e.target.value + ':00')} className="input text-xs w-full" />
          </div>
        </div>
      )}
      {isNew && (
        <>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Recorrência</label>
            <select value={form.recurrence_type ?? 'none'} onChange={e => onChange('recurrence_type', e.target.value)}
              className="input text-sm w-full">
              <option value="none">Sem recorrência</option>
              <option value="daily">Diária</option>
              <option value="weekly">Semanal</option>
            </select>
          </div>
          {form.recurrence_type && form.recurrence_type !== 'none' && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Até à data</label>
              <input type="date" value={form.recurrence_end_date ?? ''}
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
