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
import type { Reservation, ReservationStatus, Service, MeioPagamento } from '@/types'
import { hasMeaningfulReservationComment } from '@/utils/reservationComments'

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

// Cancelada não aparece aqui: cancelar deve sempre passar pelo ReservationStatusModal
// para garantir motivo obrigatório e envio de email.
export const EDIT_STATUSES: ReservationStatus[] = ['confirmada', 'concluida', 'faltou']

const MEIO_OPTIONS: { value: MeioPagamento; label: string }[] = [
  { value: 'multibanco', label: '💳 Multibanco' },
  { value: 'dinheiro',   label: '💵 Dinheiro'   },
  { value: 'outro',      label: '❓ Outro'       },
]

// ─── ReservationDetailModal ───────────────────────────────────────────────────
export function ReservationDetailModal({
  reservation, onClose, onEdit, onChangeStatus, onCancel, onCheckout, onEditPayment,
}: {
  reservation: Reservation
  onClose: () => void
  onEdit: () => void
  onChangeStatus: (action: 'faltou') => void
  onCancel: () => void
  onCheckout: () => void
  onEditPayment?: () => void
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
            <span className="font-medium">
              {r.created_by === 'online' && <span className="text-blue-600 mr-0.5">@</span>}
              {hasMeaningfulReservationComment(r.comentario) && <span className="mr-0.5">💬</span>}
              {r.client_name}
            </span>
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
        {hasMeaningfulReservationComment(r.comentario) && <NoteBox label="Notas do cliente" text={r.comentario ?? ''}   bg="gray" />}
        {r.nota_privada && <NoteBox label="Nota privada"     text={r.nota_privada} bg="amber" />}
        <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-2">
          {r.status !== 'concluida' && r.status !== 'cancelada' && r.status !== 'faltou' && (
            <button onClick={onCheckout}
              className="text-xs px-3 py-1.5 rounded-full bg-emerald-100 text-emerald-700 font-medium hover:bg-emerald-200">
              ✅ Chegou
            </button>
          )}
          {r.status === 'concluida' && onEditPayment && (
            <button onClick={onEditPayment}
              className="text-xs px-3 py-1.5 rounded-full bg-purple-100 text-purple-700 font-medium hover:bg-purple-200">
              💳 Editar Pagamento
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
  reservation, invalidateKey, onClose, onCancelRequest, onOpenCheckout,
}: {
  reservation: Reservation
  invalidateKey: string
  onClose: () => void
  onCancelRequest?: () => void
  /** Chamado quando o status muda para 'concluida' — abre o CheckoutModal antes de guardar. */
  onOpenCheckout?: (pendingForm: Partial<Reservation & { sendEmail: boolean }>) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<Partial<Reservation & { sendEmail: boolean }>>({ ...reservation, sendEmail: false })
  const [saving, setSaving] = useState(false)
  const upd = <K extends keyof typeof form>(k: K, v: typeof form[K]) => setForm(f => ({ ...f, [k]: v }))

  const { data: barbersRes }  = useQuery({ queryKey: ['barbers'],   queryFn: () => barbersApi.list() })
  const { data: servicesRes } = useQuery({ queryKey: ['services'],  queryFn: () => adminApi.get<Service[]>('/api/admin/services') })
  const barbers  = barbersRes?.data ?? []
  const services = (servicesRes?.data as unknown as Service[]) ?? []

  const handleServiceChange = (serviceId: number) => {
    const service = services.find(s => s.id === serviceId)
    setForm(f => ({ ...f, service_id: serviceId, service_duration: service?.duration ?? f.service_duration }))
  }

  const handleStatusChange = (value: string) => {
    if (value === 'cancelada') { onCancelRequest?.(); return }
    upd('status', value as ReservationStatus)
  }

  const handleSave = async () => {
    // Se o status vai mudar para 'concluida', interceptar e abrir CheckoutModal primeiro
    if (form.status === 'concluida' && reservation.status !== 'concluida') {
      onOpenCheckout?.(form)
      return
    }
    setSaving(true)
    try {
      await reservationsApi.update(reservation.id, {
        barber_id: form.barber_id, service_id: form.service_id, status: form.status,
        data_hora: form.data_hora, comentario: form.comentario, nota_privada: form.nota_privada,
        send_email: form.sendEmail, service_duration: form.service_duration,
      })
      qc.invalidateQueries({ queryKey: [invalidateKey] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  const nowLocal = new Date().toISOString().slice(0, 16)
  const isCancelled = form.status === 'cancelada' || reservation.status === 'cancelada'

  return (
    <Modal open onClose={onClose} title={`Editar reserva #${reservation.id}`}
      footer={
        <div className="flex items-center justify-between w-full gap-2">
          <div>
            {!isCancelled && onCancelRequest && (
              <button
                className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors"
                onClick={onCancelRequest}
              >
                Cancelar reserva
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button className="btn-secondary text-xs" onClick={onClose}>Fechar</button>
            <button className="btn-primary text-xs" onClick={handleSave} disabled={saving}>
              {saving ? 'A guardar...' : form.status === 'concluida' && reservation.status !== 'concluida' ? 'Guardar & Pagamento →' : 'Guardar'}
            </button>
          </div>
        </div>
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
            onChange={e => handleStatusChange(e.target.value)}
          >
            {EDIT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
            {isCancelled && <option value="cancelada" disabled>{STATUS_LABEL['cancelada']}</option>}
          </select>
          {form.status === 'concluida' && reservation.status !== 'concluida' && (
            <p className="text-[10px] text-amber-600 mt-1">⚠️ Ao guardar será pedido o preenchimento do pagamento.</p>
          )}
          {!isCancelled && form.status !== 'concluida' && (
            <p className="text-[10px] text-gray-400 mt-1">
              Para cancelar usa o botão <span className="text-red-500">Cancelar reserva</span>.
            </p>
          )}
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
          <input type="number" min={5} step={5} className="input text-sm w-full"
            value={form.service_duration ?? reservation.service_duration ?? 60}
            onChange={e => upd('service_duration', Number(e.target.value))} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
          <input type="datetime-local" className="input text-sm w-full"
            value={(form.data_hora ?? '').substring(0,16)} min={nowLocal}
            onChange={e => upd('data_hora', e.target.value+':00')} />
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
          <input type="checkbox" checked={!!form.sendEmail} onChange={e => upd('sendEmail', e.target.checked)} />
          <span>Reenviar email de confirmação ao cliente</span>
        </label>
      </div>
    </Modal>
  )
}

// ─── ReservationStatusModal ───────────────────────────────────────────────────
export function ReservationStatusModal({
  reservation, action, invalidateKey, onClose,
}: {
  reservation: Reservation
  action: 'faltou' | 'cancelada'
  invalidateKey: string
  onClose: () => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState('')
  const [error,  setError]  = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isCancel = action === 'cancelada'

  const handleConfirm = async () => {
    if (isCancel && !reason.trim()) { setError('O motivo de cancelamento é obrigatório.'); return }
    setSaving(true)
    try {
      if (isCancel) {
        await reservationsApi.update(reservation.id, { status: 'cancelada', nota_privada: `[Cancelamento] ${reason}` })
        await adminApi.post('/api/admin/reservations/cancel-email', { reservation_id: reservation.id, reason }).catch(() => {})
      } else {
        await reservationsApi.updateStatus(reservation.id, action as ReservationStatus)
      }
      qc.invalidateQueries({ queryKey: [invalidateKey] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  return (
    <Modal open onClose={onClose}
      title={isCancel ? '❌ Cancelar reserva' : '👤 Confirmar falta'}
      footer={
        <>
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className={isCancel ? 'btn-danger' : 'btn-primary'} onClick={handleConfirm} disabled={saving}>
            {saving ? 'A guardar...' : isCancel ? 'Confirmar cancelamento' : 'Confirmar falta'}
          </button>
        </>
      }>
      <div className="space-y-3 text-sm">
        {isCancel ? (
          <>
            <p className="text-gray-600">Indica o motivo do cancelamento. O cliente receberá um email com essa informação.</p>
            <textarea rows={3} value={reason}
              onChange={e => { setReason(e.target.value); setError(null) }}
              placeholder="Ex.: Barbeiro indisponível por motivo de saúde"
              className={`input text-sm w-full resize-none ${error ? 'border-red-400' : ''}`} />
            {error && <p className="text-xs text-red-500">{error}</p>}
          </>
        ) : (
          <p className="text-gray-700">{`Confirmas que ${reservation.client_name} não compareceu a esta reserva?`}</p>
        )}
      </div>
    </Modal>
  )
}

// ─── CheckoutModal ────────────────────────────────────────────────────────────
// Usado tanto para o checkout inicial ("Chegou") como para editar o pagamento
// de uma reserva já concluída, e também quando o ReservationEditModal
// transita o status para 'concluida' — nesse caso recebe pendingEditForm
// para guardar os restantes campos após o pagamento.
export function CheckoutModal({
  reservation,
  invalidateKey,
  onClose,
  editMode = false,
  pendingEditForm,
}: {
  reservation: Reservation
  invalidateKey: string
  onClose: () => void
  /** true = estamos a editar o pagamento de uma reserva já concluída */
  editMode?: boolean
  /** Campos do ReservationEditModal a guardar juntamente com o pagamento */
  pendingEditForm?: Partial<Reservation & { sendEmail: boolean }>
}) {
  const qc = useQueryClient()

  // Pré-preencher com os valores existentes se estivermos em modo edição
  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento>(
    reservation.meio_pagamento ?? 'multibanco'
  )
  const [valorPago, setValorPago]     = useState<number>(reservation.valor_pago ?? reservation.service_price ?? 0)
  const [temGorjeta, setTemGorjeta]   = useState(!!reservation.gorjeta && reservation.gorjeta > 0)
  const [gorjeta, setGorjeta]         = useState<number>(reservation.gorjeta ?? 0)
  const [meioGorjeta, setMeioGorjeta] = useState<MeioPagamento>(reservation.meio_gorjeta ?? 'dinheiro')
  const [comentario, setComentario]   = useState<string>(reservation.comentario_pagamento ?? '')
  const [error, setError]             = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  const freeReservations = reservation.client_free_reservations ?? 0
  const isOferta = meioPagamento === 'oferta'

  const handleDescontarGratuita = () => {
    setMeioPagamento('oferta')
    setValorPago(0)
  }

  const validate = (): string | null => {
    if (meioPagamento === 'outro' && !comentario.trim())
      return 'Por favor, descreve o método de pagamento usado em "Observações de Pagamento".'
    if (temGorjeta && meioGorjeta === 'outro' && !comentario.trim())
      return 'Por favor, descreve o método de gorjeta usado em "Observações de Pagamento".'
    return null
  }

  const handleConfirm = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      const paymentPayload = {
        meio_pagamento: meioPagamento,
        valor_pago: isOferta ? 0 : valorPago,
        gorjeta: temGorjeta ? gorjeta : undefined,
        meio_gorjeta: temGorjeta ? meioGorjeta : undefined,
        comentario_pagamento: comentario.trim() || undefined,
      }

      if (pendingEditForm) {
        // Vindo do ReservationEditModal com status→concluida:
        // guarda todos os campos do edit + o pagamento numa só chamada
        await reservationsApi.update(reservation.id, {
          barber_id:        pendingEditForm.barber_id,
          service_id:       pendingEditForm.service_id,
          status:           'concluida',
          data_hora:        pendingEditForm.data_hora,
          comentario:       pendingEditForm.comentario,
          nota_privada:     pendingEditForm.nota_privada,
          send_email:       pendingEditForm.sendEmail,
          service_duration: pendingEditForm.service_duration,
          ...paymentPayload,
        })
      } else {
        await reservationsApi.update(reservation.id, {
          ...(!editMode && { status: 'concluida' }),
          ...paymentPayload,
        })
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
      title={editMode ? '💳 Editar Pagamento' : '💰 Pagamento & Checkout'}
      footer={
        <>
          <button className="btn-secondary text-sm" onClick={onClose}>Cancelar</button>
          <button className="btn-primary text-sm" onClick={handleConfirm} disabled={saving}>
            {saving ? 'A guardar...' : editMode ? 'Guardar Pagamento' : 'Confirmar'}
          </button>
        </>
      }>
      <div className="space-y-4 text-sm">
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
          {reservation.client_name} · {reservation.service_name}
        </div>

        {/* Banner de reserva gratuita disponível */}
        {freeReservations > 0 && !editMode && (
          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs text-emerald-800">
            <span className="text-base">🎁</span>
            <span>
              Este cliente tem <strong>{freeReservations}</strong> reserva{freeReservations > 1 ? 's' : ''} gratuita{freeReservations > 1 ? 's' : ''} por descontar.
            </span>
          </div>
        )}

        {/* Meio de pagamento */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Meio de pagamento</label>
          <div className="flex flex-wrap gap-2">
            {MEIO_OPTIONS.map(op => (
              <button key={op.value} type="button" onClick={() => {
                setMeioPagamento(op.value)
                if (op.value !== 'oferta') setValorPago(reservation.service_price ?? 0)
              }}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  meioPagamento === op.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                }`}>
                {op.label}
              </button>
            ))}
          </div>
          {/* Botão de desconto de reserva gratuita */}
          {freeReservations > 0 && !editMode && (
            <button
              type="button"
              onClick={handleDescontarGratuita}
              className={`mt-2 w-full py-2 rounded-lg border text-xs font-medium transition-colors ${
                isOferta
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-emerald-700 border-emerald-300 hover:border-emerald-500 hover:bg-emerald-50'
              }`}>
              🎁 Descontar reserva gratuita
            </button>
          )}
        </div>

        {/* Valor cobrado — bloqueado a 0€ se oferta */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Valor cobrado (€)</label>
          <input
            type="number" min={0} step={0.5}
            className={`input text-sm w-full ${isOferta ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''}`}
            value={isOferta ? 0 : valorPago}
            disabled={isOferta}
            onChange={e => setValorPago(Number(e.target.value))}
          />
          {isOferta && (
            <p className="text-[10px] text-emerald-600 mt-1">✓ Reserva gratuita — valor definido a 0 €.</p>
          )}
        </div>

        {/* Gorjeta */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={temGorjeta} onChange={e => setTemGorjeta(e.target.checked)} className="rounded" />
          <span className="font-medium">🎁 Gorjeta?</span>
        </label>
        {temGorjeta && (
          <div className="space-y-3 pl-5 border-l-2 border-emerald-200">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Valor da gorjeta (€)</label>
              <input type="number" min={0} step={0.5} className="input text-sm w-full"
                value={gorjeta} onChange={e => setGorjeta(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Como foi recebida a gorjeta</label>
              <select className="input text-sm w-full bg-white" value={meioGorjeta}
                onChange={e => setMeioGorjeta(e.target.value as MeioPagamento)}>
                <option value="dinheiro">💵 Dinheiro</option>
                <option value="multibanco">💳 Multibanco</option>
                <option value="outro">❓ Outro</option>
              </select>
            </div>
          </div>
        )}

        {/* Comentário de pagamento */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">
            Observações de pagamento
            {(meioPagamento === 'outro' || (temGorjeta && meioGorjeta === 'outro')) && (
              <span className="text-red-500 ml-1">*</span>
            )}
          </label>
          <textarea
            rows={2}
            className={`input text-sm w-full resize-none ${
              error && (meioPagamento === 'outro' || (temGorjeta && meioGorjeta === 'outro')) && !comentario.trim()
                ? 'border-red-400'
                : ''
            }`}
            placeholder={
              meioPagamento === 'outro'
                ? 'Ex.: Transferência MB Way pessoal, Prestação Serviço, etc.'
                : 'Notas opcionais sobre o pagamento'
            }
            value={comentario}
            onChange={e => { setComentario(e.target.value); setError(null) }}
          />
          {(meioPagamento === 'outro' || (temGorjeta && meioGorjeta === 'outro')) && (
            <p className="text-[10px] text-amber-600 mt-1">⚠️ Campo obrigatório quando o método é "Outro".</p>
          )}
        </div>

        {error && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
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
