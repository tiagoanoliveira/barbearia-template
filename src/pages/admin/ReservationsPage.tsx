import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Pencil } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import { ClipboardList } from 'lucide-react'
import type { Reservation, ReservationStatus, Service } from '@/types'

const STATUS_OPTIONS = [
  { value: '',           label: 'Todos os estados' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'concluida',  label: 'Concluídas' },
  { value: 'cancelada',  label: 'Canceladas' },
  { value: 'faltou',     label: 'Não vieram' },
]
const STATUS_LABEL: Record<string, string> = {
  confirmada: 'Confirmada', concluida: 'Concluída', cancelada: 'Cancelada',
  faltou: 'Não compareceu',
}
const VALID_STATUSES = ['confirmada', 'concluida', 'cancelada', 'faltou'] as const

// ─── Modal de confirmação genérico ───────────────────────────────────────────
function ConfirmModal({
  open, title, message, confirmLabel, confirmClass, onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string
  confirmLabel: string; confirmClass?: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open={open} onClose={onCancel} title={title}
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>Não</button>
          <button className={confirmClass ?? 'btn-primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }>
      <p className="text-sm text-gray-600">{message}</p>
    </Modal>
  )
}

// ─── Modal de edição ─────────────────────────────────────────────────────────
function EditReservationModal({
  reservation, onClose,
}: { reservation: Reservation; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Reservation & { sendEmail: boolean }>>({ ...reservation, sendEmail: false })
  const [saving, setSaving] = useState(false)
  const [cancelMode, setCancelMode] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelError, setCancelError] = useState<string | null>(null)

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'], queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'], queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
  const barbers  = barbersRes?.data ?? []
  const services = (servicesRes?.data as unknown as Service[]) ?? []

  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    try {
      await reservationsApi.update(reservation.id, {
        barber_id:    form.barber_id,
        service_id:   form.service_id,
        data_hora:    form.data_hora,
        status:       form.status,
        comentario:   form.comentario,
        nota_privada: form.nota_privada,
        send_email:   form.sendEmail,
      })
      qc.invalidateQueries({ queryKey: ['reservations'] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      setCancelError('O motivo de cancelamento é obrigatório.')
      return
    }
    setCancelError(null)
    setSaving(true)
    try {
      await reservationsApi.update(reservation.id, {
        status: 'cancelada',
        nota_privada: `[Cancelamento] ${cancelReason}`,
      })
      await adminApi.post('/api/admin/reservations/cancel-email', {
        reservation_id: reservation.id, reason: cancelReason,
      }).catch(() => {})
      qc.invalidateQueries({ queryKey: ['reservations'] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose} title={cancelMode ? 'Cancelar reserva' : `Editar reserva #${reservation.id}`}
      footer={
        cancelMode
          ? <>
              <button className="btn-secondary" onClick={() => { setCancelMode(false); setCancelError(null) }}>Voltar</button>
              <button className="btn-danger" onClick={handleCancel} disabled={saving}>
                {saving ? 'A cancelar...' : 'Confirmar cancelamento'}
              </button>
            </>
          : <>
              <button className="btn-secondary text-xs text-red-500 hover:text-red-700 mr-auto"
                onClick={() => setCancelMode(true)}>❌ Cancelar reserva</button>
              <button className="btn-secondary" onClick={onClose}>Fechar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </>
      }>
      {cancelMode ? (
        <div className="space-y-3">
          <p className="text-sm text-gray-600">Indica o motivo do cancelamento. O cliente receberá um email com essa informação.</p>
          <textarea rows={3} value={cancelReason} onChange={e => { setCancelReason(e.target.value); setCancelError(null) }}
            placeholder="Ex.: Barbeiro indisponível por motivo de saúde"
            className={`input text-sm w-full resize-none ${cancelError ? 'border-red-400' : ''}`} />
          {cancelError && <p className="text-xs text-red-500">{cancelError}</p>}
        </div>
      ) : (
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded-lg px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">Cliente</p>
            <p className="font-medium">{reservation.client_name}</p>
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
            <select className="input text-sm w-full" value={form.service_id ?? ''}
              onChange={e => upd('service_id', Number(e.target.value))}>
              {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
            <input type="datetime-local" className="input text-sm w-full"
              value={(form.data_hora ?? '').substring(0,16)}
              onChange={e => upd('data_hora', e.target.value+':00')} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select className="input text-sm w-full" value={form.status ?? 'confirmada'}
              onChange={e => upd('status', e.target.value as ReservationStatus)}>
              {VALID_STATUSES.filter(s => s !== 'cancelada').map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nota do cliente</label>
            <textarea rows={2} className="input text-sm w-full resize-none"
              value={form.comentario ?? ''}
              onChange={e => upd('comentario', e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nota privada</label>
            <textarea rows={2} className="input text-sm w-full resize-none"
              value={form.nota_privada ?? ''}
              onChange={e => upd('nota_privada', e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={!!form.sendEmail}
              onChange={e => upd('sendEmail', e.target.checked)} />
            <span>Reenviar email de confirmação ao cliente</span>
          </label>
        </div>
      )}
    </Modal>
  )
}

export default function ReservationsPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [page, setPage]       = useState(1)
  const [editing, setEditing] = useState<Reservation | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', { search, status, page }],
    queryFn: () => reservationsApi.list({ search, status, page, perPage: 20 }),
    placeholderData: (prev) => prev,
  })

  const reservations = data?.data?.items ?? []
  const total        = data?.data?.total ?? 0
  const totalPages   = data?.data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Pesquisar por cliente, serviço..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9" />
        </div>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }} className="input sm:w-52">
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
        ) : reservations.length === 0 ? (
          <EmptyState icon={ClipboardList} title="Nenhuma reserva encontrada"
            description="Tenta ajustar os filtros de pesquisa." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Cliente','Serviço','Barbeiro','Data & Hora','Estado',''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-700 text-xs font-bold">{r.client_name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.client_name}</p>
                          {r.client_phone && <p className="text-xs text-gray-500">{r.client_phone}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{r.service_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{r.barber_name}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-900">{format(parseISO(r.data_hora), "d MMM yyyy", { locale: pt })}</p>
                      <p className="text-xs text-gray-500">{format(parseISO(r.data_hora), 'HH:mm')}</p>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setEditing(r)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
                          title="Editar">
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total} reservas no total</p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page===1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Anterior</button>
              <span className="text-xs text-gray-600">{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page===totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40">Seguinte</button>
            </div>
          </div>
        )}
      </Card>

      {editing && <EditReservationModal reservation={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
