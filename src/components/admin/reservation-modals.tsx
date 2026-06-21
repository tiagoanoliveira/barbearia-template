/**
 * Componentes partilhados de modais de reservas.
 * Usados em CalendarPage e ReservationsPage.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, addMinutes } from 'date-fns'
import { pt } from 'date-fns/locale'
import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { adminApi } from '@/api/client'
import Modal from '@/components/ui/Modal'
import type { Reservation, ReservationStatus, Service, MeioPagamento, Discount, ReservationHistoricoItem } from '@/types'
import { isDiscountUsable } from '@/types'
import { hasMeaningfulReservationComment } from '@/utils/reservationComments'

// ─── Constantes partilhadas ──────────────────────────────────────────────────────────────────────
const STATUS_LABEL_MAP: Record<string, string> = {
  confirmada: 'Confirmada',
  concluida:  'Concluída',
  cancelada:  'Cancelada',
  faltou:     'Não compareceu',
}
export const STATUS_LABEL = STATUS_LABEL_MAP
export const STATUS_COLORS: Record<string, string> = {
  confirmada: '#3b82f6', concluida: '#10b981', cancelada: '#ef4444', faltou: '#6b7280',
}

export const EDIT_STATUSES: ReservationStatus[] = ['confirmada', 'concluida', 'faltou']

const MEIO_OPTIONS: { value: MeioPagamento; label: string }[] = [
  { value: 'multibanco', label: '💳 Multibanco' },
  { value: 'dinheiro',   label: '💵 Dinheiro'   },
  { value: 'outro',      label: '❓ Outro'       },
]

const OFERTA_TIPO_OPTIONS = [
  { value: 'fidelidade', label: '🎁 Reserva gratuita (fidelidade)' },
  { value: 'desconto',   label: '🏷️ Desconto' },
  { value: 'cortesia',   label: '🤝 Cortesia' },
  { value: 'outro',      label: '❓ Outro' },
]

// ─── Helper: mapeia raw da API para Discount ────────────────────────────────────────────────────────────────
function mapRawDiscount(d: any): Discount {
  return {
    id:                       d.id,
    client_id:                d.cliente_id ?? null,
    name:                     d.nome,
    description:              d.descricao ?? null,
    type:                     d.tipo,
    origin:                   d.origem ?? null,
    value_percent:            d.valor_percentagem ?? null,
    value_fixed:              d.valor_fixo_centimos ?? null,
    valid_from:               d.valido_de ?? null,
    valid_to:                 d.valido_ate ?? null,
    min_reservations:         d.min_reservas ?? null,
    min_reservations_period:  d.min_reservas_periodo ?? null,
    group:                    d.grupo ?? null,
    rule_type:                d.regra_tipo ?? null,
    rule_detail:              d.regra_detalhe ?? null,
    max_uses:                 d.max_usos ?? null,
    used_count:               d.usos_feitos ?? 0,
    last_used_at:             d.usado_ultima_vez_em ?? null,
    last_used_reservation_id: d.usado_ultima_reserva_id ?? null,
    usage_comment:            d.comentario_uso ?? null,
    active:                   !!d.ativo,
    created_by_admin_id:      d.criado_por_admin_id ?? null,
    created_at:               d.criado_em,
    updated_at:               d.atualizado_em,
  }
}

// ─── Helper: calcula valor do desconto sobre o preço ───────────────────────────────────────────────────────
function calcDiscountValue(d: Discount, preco: number): number {
  if (d.value_percent != null) return Math.round(preco * d.value_percent) / 100
  if (d.value_fixed   != null) return Math.min(d.value_fixed / 100, preco)
  return 0
}

function fmtDiscountLabel(d: Discount): string {
  if (d.value_percent != null) return `${d.value_percent}%`
  if (d.value_fixed   != null) return `${(d.value_fixed / 100).toFixed(2)}€`
  return ''
}

// ─── Helper: parse historico_edicoes ──────────────────────────────────────────────────────────────────────────
function parseHistorico(raw: Reservation['historico_edicoes']): ReservationHistoricoItem[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw as ReservationHistoricoItem[]
  try { return JSON.parse(raw as string) as ReservationHistoricoItem[] } catch { return [] }
}

// Nomes amigáveis para os campos mais comuns
const FIELD_LABELS: Record<string, string> = {
  status:           'Estado',
  data_hora:        'Data/Hora',
  barber_id:        'Barbeiro',
  barber_name:      'Barbeiro',
  service_id:       'Serviço',
  service_name:     'Serviço',
  service_duration: 'Duração (min)',
  nota_privada:     'Nota privada',
  comentario:       'Nota do cliente',
  meio_pagamento:   'Meio de pagamento',
  valor_pago:       'Valor pago (€)',
  oferta_tipo:      'Tipo de oferta',
  oferta_valor:     'Valor oferta (€)',
  gorjeta:          'Gorjeta (€)',
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

function formatFieldValue(key: string, val: unknown): string {
  if (val === null || val === undefined || val === '') return '—'
  // Datas ISO
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
    try { return format(new Date(val), "d MMM yyyy, HH:mm", { locale: pt }) } catch { /* fall through */ }
  }
  return String(val)
}

// ─── ReservationDetailModal ────────────────────────────────────────────────────────────────────────────
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

// ─── Componente de histórico de edições ────────────────────────────────────────────────────────────
function HistoricoEdicoes({ historico }: { historico: ReservationHistoricoItem[] }) {
  const [open, setOpen] = useState(false)
  if (historico.length === 0) return null

  // Ordem cronológica invertida: mais recente no topo
  const sorted = [...historico].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <span>📝 Histórico de edições ({historico.length})</span>
        <span className="text-gray-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-100">
          {sorted.map((item, idx) => (
            <div key={idx} className="pt-2">
              {/* Cabeçalho da entrada */}
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-gray-700">
                  {item.editado_por ? `✏️ ${item.editado_por}` : '✏️ Edição'}
                </span>
                <span className="text-[10px] text-gray-400">
                  {format(new Date(item.timestamp), "d MMM yyyy, HH:mm", { locale: pt })}
                </span>
              </div>

              {/* Campos alterados */}
              <div className="space-y-0.5">
                {Object.entries(item.alteracoes).map(([campo, { de, para }]) => (
                  <div key={campo} className="grid grid-cols-[auto_1fr_1fr] gap-x-2 text-[11px]">
                    <span className="text-gray-400 font-medium min-w-[80px]">{fieldLabel(campo)}</span>
                    <span className="text-red-500 line-through truncate" title={formatFieldValue(campo, de)}>
                      {formatFieldValue(campo, de)}
                    </span>
                    <span className="text-emerald-600 font-medium truncate" title={formatFieldValue(campo, para)}>
                      → {formatFieldValue(campo, para)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const historico = parseHistorico(r.historico_edicoes)

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
        {hasMeaningfulReservationComment(r.comentario) && <NoteBox label="Notas do cliente" text={r.comentario ?? ''} bg="gray" />}
        {r.nota_privada && <NoteBox label="Nota privada" text={r.nota_privada} bg="amber" />}

        {/* Histórico de edições */}
        <HistoricoEdicoes historico={historico} />

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

// ─── ReservationEditModal ──────────────────────────────────────────────────────────────────────────────
export function ReservationEditModal({
  reservation, invalidateKey, onClose, onCancelRequest, onOpenCheckout,
}: {
  reservation: Reservation
  invalidateKey: string
  onClose: () => void
  onCancelRequest?: () => void
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

  const { data: barberServicesRes2 } = useQuery({
    queryKey: ['barber-services-modal', form.barber_id],
    queryFn:  () => form.barber_id
        ? adminApi.get<Service[]>(`/api/barbers/${form.barber_id}/services`)
        : adminApi.get<Service[]>('/api/admin/services'),
    enabled: !!form.barber_id,
  })
  const barberServices = (barberServicesRes2?.data as unknown as Service[]) ?? services

  const handleServiceChange = (serviceId: number) => {
    const service = barberServices.find(s => s.id === serviceId)
    setForm(f => ({
      ...f,
      service_id:       serviceId,
      service_duration: service?.duration ?? f.service_duration,
      service_price:    service?.price    ?? f.service_price,
    }))
  }

  const handleStatusChange = (value: string) => {
    if (value === 'cancelada') { onCancelRequest?.(); return }
    upd('status', value as ReservationStatus)
  }

  const handleSave = async () => {
    if (form.status === 'concluida' && reservation.status !== 'concluida') {
      onOpenCheckout?.(form)
      return
    }
    setSaving(true)
    try {
      await reservationsApi.update(reservation.id, {
        barber_id: form.barber_id, service_id: form.service_id, status: form.status,
        data_hora: form.data_hora, nota_privada: form.nota_privada,
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
                onClick={onCancelRequest}>
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
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Estado</label>
            <select className="input text-sm w-full bg-white text-gray-900"
              value={form.status ?? reservation.status}
              onChange={e => handleStatusChange(e.target.value)}>
              {EDIT_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              {isCancelled && <option value="cancelada" disabled>{STATUS_LABEL['cancelada']}</option>}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Barbeiro</label>
            <select className="input text-sm w-full" value={form.barber_id ?? ''}
              onChange={e => {
                upd('barber_id', Number(e.target.value))
                upd('service_id', undefined)
              }}>
              {barbers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>
        {form.status === 'concluida' && reservation.status !== 'concluida' && (
          <p className="text-[10px] text-amber-600">⚠️ Ao guardar será pedido o preenchimento do pagamento.</p>
        )}
        {!isCancelled && form.status !== 'concluida' && (
          <p className="text-[10px] text-gray-400">
            Para cancelar usa o botão <span className="text-red-500">Cancelar reserva</span>.
          </p>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Serviço</label>
            <select className="input text-sm w-full bg-white text-gray-900" value={form.service_id ?? ''}
              onChange={e => handleServiceChange(Number(e.target.value))}>
              {barberServices.map(s => <option key={s.id} value={s.id}>{s.name} ({s.duration} min) — {s.price}€</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Duração (min)</label>
            <input type="number" min={5} step={5} className="input text-sm w-full"
              value={form.service_duration ?? reservation.service_duration ?? 60}
              onChange={e => upd('service_duration', Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Data e hora</label>
          <input type="datetime-local" className="input text-sm w-full"
            value={(form.data_hora ?? '').substring(0,16)} min={nowLocal}
            onChange={e => upd('data_hora', e.target.value+':00')} />
        </div>
        {hasMeaningfulReservationComment(reservation.comentario) && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Nota do cliente</p>
            <p className="text-xs bg-gray-50 rounded-lg px-3 py-2 text-gray-700">{reservation.comentario}</p>
          </div>
        )}
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

// ─── ReservationStatusModal ──────────────────────────────────────────────────────────────────────────────
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

// ─── CheckoutModal ───────────────────────────────────────────────────────────────────────────────────────
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
  editMode?: boolean
  pendingEditForm?: Partial<Reservation & { sendEmail: boolean }>
}) {
  const qc = useQueryClient()
  const precoServico = pendingEditForm?.service_price ?? reservation.service_price ?? 0
  const clientId     = reservation.client_id
  const hadOferta    = !!reservation.oferta_tipo

  // ── Carregar descontos da tabela (admin routes) ──────────────────────────────────────────────────────────────────────────
  const { data: clientDiscountsRes } = useQuery({
    queryKey: ['checkout-discounts-client', clientId],
    queryFn: () => adminApi.get<any[]>(`/api/admin/discounts/client/${clientId}`),
    enabled: !!clientId && !editMode,
  })
  const { data: generalDiscountsRes } = useQuery({
    queryKey: ['checkout-discounts-general', clientId],
    queryFn: () => adminApi.get<any[]>(`/api/discounts/general?client_id=${clientId}`),
    enabled: !!clientId && !editMode,
  })

  // ── Carregar dados do cliente para verificar reservas_gratuitas_disponiveis ──────
  // Este campo é gerido pelos triggers de fidelização existentes e ainda não foi
  // migrado para a tabela de descontos — por isso verificamos diretamente aqui.
  const { data: clientRes } = useQuery({
    queryKey: ['checkout-client', clientId],
    queryFn: () => adminApi.get<any>(`/api/admin/clients/${clientId}`),
    enabled: !!clientId && !editMode,
  })
  const clientRaw = (clientRes as any)?.data
  const reservasGratuitas: number = clientRaw?.reservas_gratuitas_disponiveis ?? 0

  const clientDiscounts: Discount[]  = ((clientDiscountsRes  as any)?.data ?? []).map(mapRawDiscount)
  const generalDiscounts: Discount[] = ((generalDiscountsRes as any)?.data ?? []).map(mapRawDiscount)

  // Descontos usáveis da tabela
  const usableClientDiscounts  = clientDiscounts.filter(isDiscountUsable)
  const usableGeneralDiscounts = generalDiscounts.filter(isDiscountUsable)
  const allUsable = [...usableClientDiscounts, ...usableGeneralDiscounts]

  // ── Identificador especial para "reserva gratuita" legada (fora da tabela) ──────
  // Usamos um ID sentinel negativo para distinguir do ID de um desconto real.
  const GRATUITA_SENTINEL = -1

  // ── Estado do modal ──────────────────────────────────────────────────────────────────────────────────────────
  const [selectedDiscountId, setSelectedDiscountId] = useState<number | null>(
    reservation.desconto_id ?? null
  )
  // true quando a reserva gratuita (sentinel) está selecionada
  const isGratuitaSelected = selectedDiscountId === GRATUITA_SENTINEL

  const selectedDiscount = selectedDiscountId != null && selectedDiscountId !== GRATUITA_SENTINEL
    ? allUsable.find(d => d.id === selectedDiscountId) ?? null
    : null

  const initialValorPago = (() => {
    if (hadOferta && reservation.oferta_valor != null)
      return Math.max(0, precoServico - reservation.oferta_valor)
    return reservation.valor_pago ?? precoServico
  })()

  const [temOferta, setTemOferta]   = useState(hadOferta)
  const [ofertaTipo, setOfertaTipo] = useState<string>(reservation.oferta_tipo ?? 'fidelidade')

  const [meioPagamento, setMeioPagamento] = useState<MeioPagamento | null>(
    hadOferta && initialValorPago === 0 ? null : (reservation.meio_pagamento ?? 'multibanco')
  )
  const [valorPago, setValorPago] = useState<number | null>(
    hadOferta && initialValorPago === 0 ? null : initialValorPago
  )

  const [temGorjeta, setTemGorjeta]   = useState(!!reservation.gorjeta && reservation.gorjeta > 0)
  const [gorjeta, setGorjeta]         = useState<number>(reservation.gorjeta ?? 0)
  const [meioGorjeta, setMeioGorjeta] = useState<MeioPagamento>(reservation.meio_gorjeta ?? 'dinheiro')
  const [comentario, setComentario]   = useState<string>(reservation.comentario_pagamento ?? '')
  const [error, setError]             = useState<string | null>(null)
  const [saving, setSaving]           = useState(false)

  // ── Handler de seleção de desconto (tabela) ───────────────────────────────────────────────────────────────────
  const handleSelectDiscount = (discountId: number | null) => {
    setSelectedDiscountId(discountId)
    if (discountId === null) {
      setTemOferta(false)
      setMeioPagamento('multibanco')
      setValorPago(precoServico)
      return
    }
    // Reserva gratuita legada — desconta 100%
    if (discountId === GRATUITA_SENTINEL) {
      setTemOferta(true)
      setOfertaTipo('fidelidade')
      setMeioPagamento(null)
      setValorPago(null)
      return
    }
    const d = allUsable.find(x => x.id === discountId)
    if (!d) return
    const descVal  = calcDiscountValue(d, precoServico)
    const restante = Math.max(0, precoServico - descVal)
    setTemOferta(true)
    setOfertaTipo(d.type)
    if (restante === 0) {
      setMeioPagamento(null)
      setValorPago(null)
    } else {
      setMeioPagamento(meioPagamento ?? 'multibanco')
      setValorPago(restante)
    }
  }

  const handleToggleOferta = (checked: boolean) => {
    if (!checked) setSelectedDiscountId(null)
    setTemOferta(checked)
    if (checked) {
      setOfertaTipo('fidelidade')
      setMeioPagamento(null)
      setValorPago(null)
    } else {
      setMeioPagamento('multibanco')
      setValorPago(precoServico)
    }
  }

  const handleMeioChange = (meio: MeioPagamento) => {
    setMeioPagamento(meio)
    if (temOferta && selectedDiscount) {
      const descVal = calcDiscountValue(selectedDiscount, precoServico)
      setValorPago(Math.max(0, precoServico - descVal))
    } else if (temOferta) {
      setValorPago(null)
    }
  }

  const valorPagoEfectivo = meioPagamento === null ? 0 : (valorPago ?? 0)
  const ofertaValorEuros = temOferta
    ? Math.round(Math.max(0, precoServico - valorPagoEfectivo) * 100) / 100
    : null
  const isOfertaTotal = temOferta && meioPagamento === null

  const validate = (): string | null => {
    if (!temOferta && meioPagamento === null)
      return 'Selectiona um meio de pagamento.'
    if (!isOfertaTotal && meioPagamento !== null && (valorPago === null || valorPago < 0))
      return 'Introduz o valor cobrado ao cliente.'
    if (meioPagamento === 'outro' && !comentario.trim())
      return 'Por favor, descreve o método de pagamento em "Observações".'
    if (temGorjeta && meioGorjeta === 'outro' && !comentario.trim())
      return 'Por favor, descreve o método de gorjeta em "Observações".'
    if (temOferta && !ofertaTipo.trim())
      return 'Indica o tipo de oferta.'
    return null
  }

  const handleConfirm = async () => {
    const err = validate()
    if (err) { setError(err); return }
    setSaving(true)
    try {
      // O desconto_id enviado à API não deve incluir o sentinel (-1)
      const discountIdForApi = selectedDiscountId === GRATUITA_SENTINEL ? null : selectedDiscountId

      const paymentPayload: Record<string, unknown> = {
        meio_pagamento:       isOfertaTotal ? null : meioPagamento,
        valor_pago:           valorPagoEfectivo,
        gorjeta:              temGorjeta ? gorjeta : undefined,
        meio_gorjeta:         temGorjeta ? meioGorjeta : undefined,
        comentario_pagamento: comentario.trim() || undefined,
        oferta_valor:         ofertaValorEuros,
        oferta_tipo:          temOferta ? ofertaTipo : null,
        desconto_id:          discountIdForApi ?? null,
      }

      if (pendingEditForm) {
        await reservationsApi.update(reservation.id, {
          barber_id:        pendingEditForm.barber_id,
          service_id:       pendingEditForm.service_id,
          status:           'concluida',
          data_hora:        pendingEditForm.data_hora,
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

      // Registar uso de desconto da tabela via /apply
      if (discountIdForApi != null && !editMode) {
        await adminApi.post(`/api/admin/discounts/${discountIdForApi}/apply`, {
          reserva_id:   reservation.id,
          oferta_valor: ofertaValorEuros != null ? Math.round(ofertaValorEuros * 100) : null,
        }).catch(() => {})
      }

      // Se foi usada uma reserva gratuita (legado), decrementar o contador via API
      if (isGratuitaSelected && !editMode) {
        await adminApi.post(`/api/admin/clients/${clientId}/usar-gratuita`, {
          reserva_id: reservation.id,
        }).catch(() => {})
      }

      qc.invalidateQueries({ queryKey: [invalidateKey] })
      onClose()
    } catch {}
    finally { setSaving(false) }
  }

  // Flag de conveniência: há algo (desconto tabela ou gratuita legada) para mostrar
  const hasAnyDiscount = allUsable.length > 0 || reservasGratuitas > 0

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

        {/* Cabeçalho */}
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-500">
          {reservation.client_name} · {reservation.service_name}
          {precoServico > 0 && (
            <span className="ml-2 font-semibold text-gray-700">{precoServico.toFixed(2)} €</span>
          )}
        </div>

        {/* ── Painel de descontos aplicáveis (apenas no checkout, não em editMode) ── */}
        {!editMode && hasAnyDiscount && (
          <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-brand-700">🏷️ Descontos aplicáveis</p>

            {/* ─ Reserva gratuita legada (triggers de fidelização) ─ */}
            {reservasGratuitas > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Fidelização (reservas gratuitas)</p>
                <button
                  type="button"
                  onClick={() => handleSelectDiscount(
                    isGratuitaSelected ? null : GRATUITA_SENTINEL
                  )}
                  className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                    isGratuitaSelected
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                  }`}
                >
                  <span className="font-medium">⭐ Reserva gratuita</span>
                  <span className="ml-2 opacity-75">— Desconto Fidelização</span>
                  <span className={`ml-2 font-semibold ${
                    isGratuitaSelected ? 'text-white' : 'text-emerald-600'
                  }`}>
                    (−{precoServico.toFixed(2)}€)
                  </span>
                </button>
              </div>
            )}

            {/* ─ Descontos exclusivos do cliente (tabela) ─ */}
            {usableClientDiscounts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Exclusivos deste cliente</p>
                {usableClientDiscounts.map(d => {
                  const selected = selectedDiscountId === d.id
                  const descVal  = calcDiscountValue(d, precoServico)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDiscount(selected ? null : d.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        selected
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                      }`}
                    >
                      <span className="font-medium">{d.name}</span>
                      <span className="ml-2 opacity-75">— {fmtDiscountLabel(d)}</span>
                      {descVal > 0 && (
                        <span className={`ml-2 font-semibold ${selected ? 'text-white' : 'text-emerald-600'}`}>
                          (−{descVal.toFixed(2)}€)
                        </span>
                      )}
                      {d.max_uses != null && (
                        <span className="ml-2 opacity-60">[{d.used_count}/{d.max_uses}]</span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {/* ─ Descontos gerais (tabela) ─ */}
            {usableGeneralDiscounts.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-wide text-gray-400">Descontos gerais</p>
                {usableGeneralDiscounts.map(d => {
                  const selected = selectedDiscountId === d.id
                  const descVal  = calcDiscountValue(d, precoServico)
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleSelectDiscount(selected ? null : d.id)}
                      className={`w-full text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                        selected
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-brand-400'
                      }`}
                    >
                      <span className="font-medium">{d.name}</span>
                      <span className="ml-2 opacity-75">— {fmtDiscountLabel(d)}</span>
                      {descVal > 0 && (
                        <span className={`ml-2 font-semibold ${selected ? 'text-white' : 'text-emerald-600'}`}>
                          (−{descVal.toFixed(2)}€)
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            )}

            {selectedDiscountId != null && (
              <button
                type="button"
                onClick={() => handleSelectDiscount(null)}
                className="text-[10px] text-gray-400 hover:text-gray-600 underline"
              >
                Remover desconto selecionado
              </button>
            )}
          </div>
        )}

        {/* Toggle oferta manual (sem desconto selecionado) */}
        {selectedDiscountId == null && (
          <div className={`rounded-lg border p-3 space-y-3 transition-colors ${
            temOferta ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-200'
          }`}>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={temOferta}
                onChange={e => handleToggleOferta(e.target.checked)}
                className="rounded"
              />
              <span className={`font-medium ${temOferta ? 'text-emerald-800' : 'text-gray-700'}`}>
                🏷️ Aplicar oferta / desconto manual
              </span>
            </label>

            {temOferta && (
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo de oferta</label>
                <select
                  className="input text-sm w-full bg-white"
                  value={ofertaTipo}
                  onChange={e => setOfertaTipo(e.target.value)}
                >
                  {OFERTA_TIPO_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        {/* Resumo do desconto selecionado (tabela) */}
        {selectedDiscount && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800">
            🏷️ Desconto <strong>{selectedDiscount.name}</strong> selecionado
            {' '}— poupa <strong>{calcDiscountValue(selectedDiscount, precoServico).toFixed(2)} €</strong>
            {selectedDiscount.max_uses === 1 && (
              <span className="ml-1 text-amber-700">(único uso — será marcado como usado)</span>
            )}
          </div>
        )}

        {/* Resumo da reserva gratuita legada quando selecionada */}
        {isGratuitaSelected && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50/50 px-3 py-2 text-xs text-emerald-800">
            ⭐ <strong>Reserva gratuita</strong> selecionada (oferta de fidelização do cliente).
          </div>
        )}

        {/* Meio de pagamento */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">
            {isOfertaTotal ? 'Meio de pagamento — sem cobrança ao cliente' : 'Meio de pagamento'}
          </label>
          <div className="flex flex-wrap gap-2">
            {temOferta && (
              <button
                type="button"
                onClick={() => { setMeioPagamento(null); setValorPago(null) }}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  meioPagamento === null
                    ? 'bg-emerald-600 text-white border-emerald-600'
                    : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-400'
                }`}>
                ✕ Sem pagamento
              </button>
            )}
            {MEIO_OPTIONS.map(op => (
              <button
                key={op.value}
                type="button"
                onClick={() => handleMeioChange(op.value)}
                className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors ${
                  meioPagamento === op.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                }`}>
                {op.label}
              </button>
            ))}
          </div>
        </div>

        {/* Valor cobrado */}
        {meioPagamento !== null && (
          <div>
            <label className="block text-xs text-gray-500 mb-1">Valor cobrado ao cliente (€)</label>
            <input
              type="number" min={0} max={precoServico} step={0.5}
              className="input text-sm w-full"
              value={valorPago ?? ''}
              placeholder="0.00"
              onChange={e => {
                const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
                setValorPago(v)
                setError(null)
              }}
            />
            {temOferta && valorPago !== null && valorPago >= 0 && (
              <p className="text-[10px] text-emerald-700 mt-1">
                Oferta de {(precoServico - Math.min(valorPago, precoServico)).toFixed(2)} € · cliente paga {Math.min(valorPago, precoServico).toFixed(2)} €
              </p>
            )}
          </div>
        )}

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

        {/* Observações */}
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
                ? 'border-red-400' : ''
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
