/**
 * Componentes partilhados de modais de reservas.
 * Usados em CalendarPage e ReservationsPage.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addMinutes } from 'date-fns'
import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { adminApi } from '@/api/client'
import Modal from '@/components/ui/Modal'
import type { Reservation, ReservationStatus, Service } from '@/types'

// ─── Constantes partilhadas ───────────────────────────────────────────────────
export const STATUS_LABEL: Record<string, string> = {
  confirmada: 'Confirmada',
  concluida:  'Concluída',
  cancelada:  'Cancelada',
  faltou:     'Não compareceu',
}
export const STATUS_COLORS: Record<string, string> = {
  confirmada: '#3b82f6', concluida: '#10b981', cancelada: '#ef4444', faltou: '#6b7280',
}
// Na edição é possível alterar diretamente para qualquer estado, incluindo cancelada.
export const EDIT_STATUSES: ReservationStatus[] = ['confirmada', 'concluida', 'faltou', 'cancelada']

// ─── ReservationDetailModal ───────────────────────────────────────────────────
export function ReservationDetailModal({
  reservation, onClose, onEdit, onChangeStatus, onCancel,
}: {
  reservation: Reservation
  onClose: () => void
  onEdit: () => void
  onChangeStatus: (action: 'concluida' | 'faltou') => void
  onCancel: () => void
}) {
  const r = reservation
  const dt    = new Date(r.data_hora)
  const endDt = addMinutes(dt, r.service_duration ?? 60)
  return (
    <Modal open onClose={onClose} title="Detalhe da reserva">
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Cliente</span>
          <div className="flex items-center gap-2">
            {r.client_photo_url ? (
              <img src={r.client_photo_url} alt={r.client_name} className="w-9 h-9 rounded-xl object-cover" />
            ) : (
              <span className="w-9 h-9 rounded-xl bg-gray-100 text-xs font-semibold flex items-center justify-center text-gray-700">
                {r.client_name.charAt(0).toUpperCase()}
              </span>
            )}
            <span className="font-medium">{r.client_name}</span>
          </div>
        </div>
        {r.client_phone && (
          <Row label="Telefone" value={<a href={`tel:${r.client_phone}`} className="text-brand-600">{r.client_phone}</a>} />
        )}
        <Row label="Serviço"  value={r.service_name} />
        <Row label="Horário"  value={`${format(dt,'HH:mm')} – ${format(endDt,'HH:mm')}`} />
        <Row label="Estado"   value={
          <span className="text-xs px-2 py-1 rounded-full text-white font-medium"
            style={{ background: STATUS_COLORS[r.status] ?? '#888' }}>
            {STATUS_LABEL[r.status] ?? r.status}
          </span>
        } />
        {r.comentario   && <NoteBox label="Notas do cliente" text={r.comentario}   bg="gray" />}
        {r.nota_privada && <NoteBox label="Nota privada"     text={r.nota_privada} bg="amber" />}
        <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2">
          {r.status !== 'concluida' && r.status !== 'cancelada' && r.status !== 'faltou' && (
            <button onClick={() => onChangeStatus('concluida')}
              className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200">
              ✅ Chegou
            </button>
          )}
          {r.status !== 'faltou' && r.status !== 'cancelada' && (
            <button onClick={() => onChangeStatus('faltou')}
              className="text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 font-medium hover:bg-gray-200">
              👤 Faltou
            </button>
          )}
          <button onClick={onEdit}
            className="text-xs px-3 py-1.5 rounded-full bg-blue-100 text-blue-600 font-medium hover:bg-blue-200">
            ✏️ Editar
          </button>
          {r.status !== 'cancelada' && (
            <button onClick={onCancel}
              className="text-xs px-3 py-1.5 rounded-full bg-red-100 text-red-600 font-medium hover:bg-red-200">
              Cancelar reserva
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}

// ─── ReservationEditModal ─────────────────────────────────────────────────────
export function ReservationEditModal({
  reservation, invalidateKey, onClose,
}: {
  reservation: Reservation
  invalidateKey: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Reservation & { sendEmail: boolean }>>({
    ...reservation, sendEmail: false,
  })
  const [saving, setSaving] = useState(false)
  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'],   queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'], queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
  const barbers  = barbersRes?.data ?? []
  const services = (servicesRes?.data as unknown as Service[]) ?? []

  const handleServiceChange = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId)
    setForm(f => ({
      ...f,
      service_id: serviceId,
      service_duration: service?.duration ?? f.service_duration,
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await reservationsApi.update(reservation.id, {
        barber_id:        form.barber_id,
        service_id:       form.service_id,
        status:           form.status,
        data_hora:        form.data_hora,
        comentario:       form.comentario,
        nota_privada:     form.nota_privada,
        send_email:       form.sendEmail,
        service_duration: form.service_duration,
      })
      qc.invalidateQueries({ queryKey: [invalidateKey] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  const nowLocal = new Date().toISOString().slice(0, 16)

  return (
    <Modal open onClose={onClose} title={`Editar reserva #${reservation.id}`}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Fechar</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </>
      }>
      <div className="space-y-3 text-sm">
        <div className="bg-gray-50 rounded-lg px-3 py-2">
          <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
          <p className="font-medium">{reservation.client_name}</p>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Estado</label>
          <select
            className="input text-sm w-full bg-white text-gray-900"
            value={form.status ?? reservation.status}
            onChange={e => upd('status', e.target.value as ReservationStatus)}
          >
            {EDIT_STATUSES.map(s => (
              <option key={s} value={s}>{STATUS_LABEL[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
          <select className="input text-sm w-full" value={form.barber_id ?? ''}
            onChange={e => upd('barber_id', Number(e.target.value))}>
            {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Serviço</label>
          <select className="input text-sm w-full bg-white text-gray-900" value={form.service_id ?? ''}
            onChange={e => handleServiceChange(Number(e.target.value))}>
            {services.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Duração (min)</label>
          <input
            type="number"
            min={5}
            step={5}
            className="input text-sm w-full"
            value={form.service_duration ?? reservation.service_duration ?? 60}
            onChange={e => upd('service_duration', Number(e.target.value))}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
          <input
            type="datetime-local"
            className="input text-sm w-full"
            value={(form.data_hora ?? '').substring(0,16)}
            min={nowLocal}
            onChange={e => upd('data_hora', e.target.value+':00')}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nota do cliente</label>
          <textarea rows={2} className="input text-sm w-full resize-none"
            value={form.comentario ?? ''} onChange={e => upd('comentario', e.target.value)} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Nota privada</label>
          <textarea rows={2} className="input text-sm w-full resize-none"
            value={form.nota_privada ?? ''} onChange={e => upd('nota_privada', e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={!!form.sendEmail}
            onChange={e => upd('sendEmail', e.target.checked)} />
          <span>Reenviar email de confirmação ao cliente</span>
        </label>
      </div>
    </Modal>
  )
}

// ─── ReservationStatusModal ───────────────────────────────────────────────────
// Modal dedicado à alteração de estado. Para 'cancelada' pede motivo obrigatório.
// Para 'concluida' e 'faltou' pede confirmação simples.
export function ReservationStatusModal({
  reservation, action, invalidateKey, onClose,
}: {
  reservation: Reservation
  action: 'concluida' | 'faltou' | 'cancelada'
  invalidateKey: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error,  setError]  = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isCancel = action === 'cancelada'

  const titles: Record<typeof action, string> = {
    concluida: '✅ Confirmar presença',
    faltou:    '👤 Confirmar falta',
    cancelada: '❌ Cancelar reserva',
  }
  const confirmLabels: Record<typeof action, string> = {
    concluida: 'Confirmar presença',
    faltou:    'Confirmar falta',
    cancelada: 'Confirmar cancelamento',
  }

  const handleConfirm = async () => {
    if (isCancel && !reason.trim()) {
      setError('O motivo de cancelamento é obrigatório.')
      return
    }
    setSaving(true)
    try {
      if (isCancel) {
        await reservationsApi.update(reservation.id, {
          status: 'cancelada',
          nota_privada: `[Cancelamento] ${reason}`,
        })
        await adminApi.post('/api/admin/reservations/cancel-email', {
          reservation_id: reservation.id, reason,
        }).catch(() => {})
      } else {
        await reservationsApi.updateStatus(reservation.id, action as ReservationStatus)
      }
      qc.invalidateQueries({ queryKey: [invalidateKey] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={titles[action]}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button
            className={isCancel ? 'btn-danger' : 'btn-primary'}
            onClick={handleConfirm}
            disabled={saving}
          >
            {saving ? 'A guardar...' : confirmLabels[action]}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {isCancel ? (
          <>
            <p className="text-gray-600">
              Indica o motivo do cancelamento. O cliente receberá um email com essa informação.
            </p>
            <textarea
              rows={3}
              value={reason}
              onChange={e => { setReason(e.target.value); setError(null) }}
              placeholder="Ex.: Barbeiro indisponível por motivo de saúde"
              className={`input text-sm w-full resize-none ${error ? 'border-red-400' : ''}`}
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </>
        ) : (
          <p className="text-gray-700">
            {action === 'concluida'
              ? `Confirmas que ${reservation.client_name} chegou e a reserva foi concluída?`
              : `Confirmas que ${reservation.client_name} não compareceu a esta reserva?`
            }
          </p>
        )}
      </div>
    </Modal>
  )
}

// ─── Helpers internos ─────────────────────────────────────────────────────────
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
