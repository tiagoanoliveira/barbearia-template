import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, parseISO, isFuture, isPast } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Mail, Pencil, Phone, Star, CalendarClock, CalendarCheck, Gift, ShieldAlert, Lock, Unlock } from 'lucide-react'
import { clientsApi } from '@/api/clients'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { StatusBadge } from '@/components/ui/Badge'
import type { Client, Reservation, ReservationStatus } from '@/types'
import {
  ReservationDetailModal,
  ReservationEditModal,
  ReservationStatusModal,
  CheckoutModal,
} from '@/components/admin/reservation-modals'
import { barberShopConfig } from '@/config/theme'

const LOYALTY = barberShopConfig.loyalty

// Número de reservas PAGAS antes de ganhar a gratuita.
// Ex: everyN=10 → stampsNeeded=9 → após 9 pagas, a 10ª é gratuita.
const STAMPS_NEEDED = LOYALTY.everyN - 1

type ClientModalData = {
  id: number
  name: string
  email?: string
  phone?: string
  photo_url?: string
  nif?: number
  notes?: string
  created_at?: string
  reservas_concluidas?: number
  reservas_gratuitas_disponiveis?: number
  next_appointment_date?: string
  last_appointment_date?: string
  blocked?: boolean
  blocked_reason?: string | null
  blocked_at?: string | null
  reservations?: ClientReservation[]
}

type ClientUpdatePayload = {
  name?: string
  email?: string
  phone?: string
  nif?: number | ''
  notes?: string | null
  reservas_concluidas?: number
  reservas_gratuitas_disponiveis?: number
  blocked?: boolean
  blocked_reason?: string | null
}

type ClientReservation = {
  id: number
  data_hora: string
  status: ReservationStatus
  service_name: string
  service_duration?: number
  service_price?: number
  barber_name: string
  comentario?: string
  nota_privada?: string
  client_id?: number
  client_name?: string
  client_phone?: string
  client_email?: string
  client_photo_url?: string
  barber_id?: number
  barber_color?: string
  service_id?: number
  created_by?: 'online' | 'admin' | 'barbeiro'
}

type Tab = 'info' | 'reservations'

type ReservationModal =
  | { type: 'detail';   r: Reservation }
  | { type: 'edit';     r: Reservation }
  | { type: 'status';   r: Reservation; action: 'faltou' | 'cancelada' }
  | { type: 'checkout'; r: Reservation; editMode?: boolean }
  | null

function toReservation(r: ClientReservation, client: ClientModalData): Reservation {
  return {
    id:               r.id,
    data_hora:        r.data_hora,
    status:           r.status,
    service_name:     r.service_name,
    service_duration: r.service_duration ?? 60,
    service_price:    r.service_price ?? 0,
    service_id:       r.service_id ?? undefined,
    barber_name:      r.barber_name,
    barber_id:        r.barber_id ?? undefined,
    comentario:       r.comentario,
    nota_privada:     r.nota_privada,
    client_id:        r.client_id ?? client.id,
    client_name:      r.client_name ?? client.name,
    client_phone:     r.client_phone ?? client.phone,
    client_email:     r.client_email ?? client.email,
    client_photo_url: r.client_photo_url ?? client.photo_url,
    created_by:       r.created_by,
  }
}

function ClientAvatar({ client, size = 16 }: { client: ClientModalData; size?: 8 | 16 }) {
  const sizeClass = size === 16 ? 'w-16 h-16' : 'w-8 h-8'
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [client.photo_url])
  if (client.photo_url && !imgError) {
    return (
      <img src={client.photo_url} alt={client.name}
        className={`${sizeClass} rounded-xl object-cover flex-shrink-0`}
        onError={() => setImgError(true)} />
    )
  }
  return (
    <div className={`${sizeClass} bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand-700 font-semibold text-xs">{client.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function FidelityStamps({ count, everyN }: { count: number; everyN: number }) {
  const progress = (count ?? 0) % everyN
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {Array.from({ length: everyN }).map((_, i) => (
        <span
          key={i}
          className={`inline-block w-2 h-2 rounded-full ${
            i < progress ? 'bg-brand-500' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  )
}

function ReservationRow({ r, onClick }: { r: ClientReservation; onClick: () => void }) {
  const fmtDt = (iso: string) => {
    try { return format(parseISO(iso), "d MMM yyyy 'às' HH:mm", { locale: pt }) } catch { return iso }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-start justify-between gap-2 py-2.5 border-b border-gray-50 last:border-0 hover:bg-black/[0.02] rounded-lg px-1 transition-colors text-left"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{r.service_name}</p>
        <p className="text-xs text-gray-500">{r.barber_name} · {fmtDt(r.data_hora)}</p>
      </div>
      <div className="flex-shrink-0 flex items-center gap-2">
        {r.service_price != null && (
          <span className="text-xs font-semibold text-gray-700">{r.service_price}€</span>
        )}
        <StatusBadge status={r.status} />
      </div>
    </button>
  )
}

export function ClientDetailModal({
  clientId, initialClient, onClose,
}: {
  clientId: number
  initialClient?: ClientModalData | null
  onClose: () => void
}) {
  const qc = useQueryClient()
  const { data: clientRes } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
    enabled: !!clientId,
  })
  const currentClient = (clientRes?.data as ClientModalData | undefined) ?? initialClient ?? null
  const [clientData, setClientData]   = useState<ClientModalData | null>(currentClient)
  const [editMode, setEditMode]       = useState(false)
  const [activeTab, setActiveTab]     = useState<Tab>('info')
  const [resModal, setResModal]       = useState<ReservationModal>(null)
  const [form, setForm] = useState({
    name:  currentClient?.name  ?? '',
    email: currentClient?.email ?? '',
    phone: currentClient?.phone ?? '',
    nif:   currentClient?.nif ? String(currentClient.nif) : '',
    notes: currentClient?.notes ?? '',
    reservas_concluidas: currentClient?.reservas_concluidas ?? 0,
    reservas_gratuitas_disponiveis: currentClient?.reservas_gratuitas_disponiveis ?? 0,
    blocked: currentClient?.blocked ?? false,
    blocked_reason: currentClient?.blocked_reason ?? '',
  })
  const [saving, setSaving]       = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setClientData(currentClient)
    setForm({
      name:  currentClient?.name  ?? '',
      email: currentClient?.email ?? '',
      phone: currentClient?.phone ?? '',
      nif:   currentClient?.nif ? String(currentClient.nif) : '',
      notes: currentClient?.notes ?? '',
      reservas_concluidas: currentClient?.reservas_concluidas ?? 0,
      reservas_gratuitas_disponiveis: currentClient?.reservas_gratuitas_disponiveis ?? 0,
      blocked: currentClient?.blocked ?? false,
      blocked_reason: currentClient?.blocked_reason ?? '',
    })
    setEditMode(false)
    setSaveError(null)
  }, [currentClient])

  const deleteM = useMutation({
    mutationFn: () => clientsApi.delete(clientId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose() },
  })

  const handleSave = async () => {
    setSaving(true); setSaveError(null)
    try {
      const nifPayload = form.nif.trim() === '' ? '' : form.nif
      const payload: ClientUpdatePayload = {
        name:  form.name,
        email: form.email,
        phone: form.phone,
        nif:   (nifPayload === '' ? '' : Number(nifPayload)) as number | '',
        notes: form.notes,
        reservas_concluidas: form.reservas_concluidas,
        reservas_gratuitas_disponiveis: form.reservas_gratuitas_disponiveis,
      }

      // Enviar apenas se houver alteração no estado de bloqueio
      if (clientData?.blocked !== form.blocked || (form.blocked && form.blocked_reason !== clientData?.blocked_reason)) {
        payload.blocked = form.blocked
        payload.blocked_reason = form.blocked ? (form.blocked_reason || null) : null
      }

      const res = await clientsApi.update(clientId, payload)
      if (!res.success || !res.data) throw new Error(res.error ?? 'Não foi possível guardar as alterações.')
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setClientData(res.data as Client)
      setEditMode(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível guardar as alterações.')
    } finally { setSaving(false) }
  }

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'd MMM yyyy', { locale: pt }) } catch { return '—' }
  }
  const fmtAgo = (iso?: string) => {
    if (!iso) return null
    try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt }) } catch { return null }
  }

  const allReservations: ClientReservation[] = (clientData?.reservations ?? []).map(r => ({
    ...r, status: r.status as ReservationStatus,
  }))
  const futureReservations = allReservations.filter(r => isFuture(parseISO(r.data_hora)))
  const pastReservations   = allReservations.filter(r => isPast(parseISO(r.data_hora)))

  const openReservation = (r: ClientReservation) => {
    if (!clientData) return
    setResModal({ type: 'detail', r: toReservation(r, clientData) })
  }

  const closeResModal = () => setResModal(null)

  const concluded       = clientData?.reservas_concluidas ?? 0
  const freeAvailable   = clientData?.reservas_gratuitas_disponiveis ?? 0
  const progressInCycle = concluded % LOYALTY.everyN
  const isNextFree  = progressInCycle === STAMPS_NEEDED
  const faltamNoCiclo = isNextFree ? 0 : STAMPS_NEEDED - progressInCycle

  if (!clientData) {
    return (
      <Modal open={true} onClose={onClose} title="Cliente">
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      </Modal>
    )
  }

  const modalTitle = editMode
    ? `Editar ${clientData.name}`
    : (
        <span className="flex items-center gap-4">
          <ClientAvatar client={clientData} size={16} />
          {clientData.name}
          <span className="text-xs font-normal text-gray-400">#{clientData.id}</span>
          {Boolean(clientData.blocked) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-[11px] font-semibold text-red-700">
              <ShieldAlert size={11} /> Bloqueado
            </span>
          )}
        </span>
      )

  return (
    <>
      <Modal
        open={true}
        onClose={onClose}
        title={modalTitle}
        footer={
          editMode
            ? <>
                <button className="btn-secondary" onClick={() => setEditMode(false)}>Cancelar</button>
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'A guardar...' : 'Guardar'}
                </button>
              </>
            : <>
                <button
                  onClick={() => { if (window.confirm(`Eliminar "${clientData.name}"? Esta acção é irreversível.`)) deleteM.mutate() }}
                  disabled={deleteM.isPending}
                  className="text-xs text-red-500 hover:text-red-700 mr-auto disabled:opacity-50">
                  {deleteM.isPending ? 'A eliminar...' : '🗑️ Eliminar'}
                </button>
                <button
                  onClick={() => setEditMode(true)}
                  className="btn-secondary flex items-center gap-1"
                >
                  <Pencil size={14} /> Editar
                </button>
                <button onClick={onClose} className="btn-secondary">Fechar</button>
              </>
        }
      >
        {editMode ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome <span className="text-red-400">*</span></label>
                <input type="text" value={form.name}
                  onChange={e => { setForm(f => ({...f, name: e.target.value})); setSaveError(null) }}
                  className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Email</label>
                <input type="email" value={form.email}
                  onChange={e => { setForm(f => ({...f, email: e.target.value})); setSaveError(null) }}
                  className="input text-sm w-full" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Telefone</label>
                <input type="tel" value={form.phone}
                  onChange={e => { setForm(f => ({...f, phone: e.target.value})); setSaveError(null) }}
                  className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">NIF</label>
                <input type="text" value={form.nif}
                  onChange={e => { setForm(f => ({...f, nif: e.target.value})); setSaveError(null) }}
                  className="input text-sm w-full" placeholder="Ex: 123456789" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Reservas concluídas</label>
                <input type="number" min={0} value={form.reservas_concluidas}
                  onChange={e => { setForm(f => ({...f, reservas_concluidas: Number(e.target.value)})); setSaveError(null) }}
                  className="input text-sm w-full" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Gratuitas disponíveis</label>
                <input type="number" min={0} value={form.reservas_gratuitas_disponiveis}
                  onChange={e => { setForm(f => ({...f, reservas_gratuitas_disponiveis: Number(e.target.value)})); setSaveError(null) }}
                  className="input text-sm w-full" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Notas internas</label>
              <textarea rows={3} value={form.notes}
                onChange={e => { setForm(f => ({...f, notes: e.target.value})); setSaveError(null) }}
                className="input text-sm w-full resize-none" />
            </div>

            <div className="border-t border-gray-100 pt-3 mt-2 space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
                <ShieldAlert size={12} className="text-red-500" /> Bloqueio de reservas
              </p>
              <label className="flex items-start gap-3 text-xs text-gray-700 cursor-pointer select-none">
                <span className="mt-0.5">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={form.blocked}
                    onChange={e => {
                      const checked = e.target.checked
                      setForm(f => ({ ...f, blocked: checked }))
                      if (!checked) {
                        setForm(f => ({ ...f, blocked_reason: '' }))
                      }
                      setSaveError(null)
                    }}
                  />
                </span>
                <span>
                  <span className="font-medium flex items-center gap-1">
                    {form.blocked ? <Lock size={11} /> : <Unlock size={11} />}
                    {form.blocked ? 'Cliente bloqueado' : 'Cliente ativo'}
                  </span>
                  <span className="block text-[11px] text-gray-500 mt-0.5">
                    Se bloqueado, o cliente deixa de conseguir criar novas reservas online.
                  </span>
                </span>
              </label>
              {form.blocked && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Motivo do bloqueio (visível na mensagem de erro)</label>
                  <textarea
                    rows={2}
                    value={form.blocked_reason}
                    onChange={e => { setForm(f => ({ ...f, blocked_reason: e.target.value })); setSaveError(null) }}
                    className="input text-xs w-full resize-none"
                    placeholder="Ex.: Faltas recorrentes sem aviso prévio."
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Esta mensagem aparece para o cliente quando tentar reservar online.
                  </p>
                </div>
              )}
            </div>

            {saveError && <p className="text-xs text-red-500">{saveError}</p>}
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              <button onClick={() => setActiveTab('info')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Star size={12} /> Informações
              </button>
              <button onClick={() => setActiveTab('reservations')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeTab === 'reservations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <CalendarClock size={12} /> Reservas
                {allReservations.length > 0 && (
                  <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 rounded-full">
                    {allReservations.length}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'info' && (
              <>
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contactos</p>
                  <div className="space-y-1.5">
                    {clientData.email && (
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-gray-400" />
                        <a href={`mailto:${clientData.email}`} className="text-brand-600 hover:underline">{clientData.email}</a>
                      </div>
                    )}
                    {clientData.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-gray-400" />
                        <a href={`tel:${clientData.phone}`} className="text-brand-600 hover:underline">{clientData.phone}</a>
                      </div>
                    )}
                    {clientData.nif && (
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">NIF</span>
                        <span>{clientData.nif}</span>
                      </div>
                    )}
                  </div>
                </section>

                {LOYALTY.enabled && (
                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fidelização</p>
                    <div className="flex items-center gap-3 mb-2">
                      <Star size={14} className="text-amber-500" />
                      <span>{concluded} visitas no total</span>
                      {freeAvailable > 0 && (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-[11px] font-semibold px-2 py-0.5 rounded-full">
                          <Gift size={11} /> {freeAvailable}× grátis disponível
                        </span>
                      )}
                    </div>
                    <FidelityStamps count={concluded} everyN={LOYALTY.everyN} />
                    <p className="text-xs text-gray-400 mt-1">
                      {isNextFree
                        ? <span className="text-emerald-600 font-semibold">✨ A próxima visita é gratuita!</span>
                        : faltamNoCiclo === STAMPS_NEEDED
                          ? `A contar para o próximo corte grátis (${STAMPS_NEEDED} visita${STAMPS_NEEDED !== 1 ? 's' : ''} necessárias)`
                          : `${faltamNoCiclo} visita${faltamNoCiclo !== 1 ? 's' : ''} para o próximo corte grátis`
                      }
                    </p>
                  </section>
                )}

                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resumo</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Última visita</p>
                      <p className="font-medium">
                        {fmtDate(clientData.last_appointment_date)}
                        {fmtAgo(clientData.last_appointment_date) && (
                          <span className="text-gray-400"> ({fmtAgo(clientData.last_appointment_date)})</span>
                        )}
                      </p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <p className="text-gray-500">Próxima reserva</p>
                      <p className="font-medium">{fmtDate(clientData.next_appointment_date)}</p>
                    </div>
                  </div>
                </section>

                {Boolean(clientData.blocked) && (
                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1 flex items-center gap-1.5">
                      <ShieldAlert size={12} className="text-red-500" /> Estado de bloqueio
                    </p>
                    <div className="bg-red-50 border border-red-100 rounded-lg px-3 py-2 text-[11px] text-red-700 space-y-0.5">
                      <p className="font-semibold flex items-center gap-1">
                        <Lock size={11} /> Cliente bloqueado para novas reservas online
                      </p>
                      {clientData.blocked_reason && (
                        <p>Motivo: {clientData.blocked_reason}</p>
                      )}
                      {clientData.blocked_at && (
                        <p className="text-red-600/80">Desde {fmtDate(clientData.blocked_at)}</p>
                      )}
                    </div>
                  </section>
                )}

                {clientData.notes && (
                  <section>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</p>
                    <p className="text-xs bg-amber-50 rounded-lg px-3 py-2 text-amber-800">{clientData.notes}</p>
                  </section>
                )}
                <p className="text-xs text-gray-400">Cliente desde {fmtDate(clientData.created_at)}</p>
              </>
            )}

            {activeTab === 'reservations' && (
              <div className="space-y-4">
                {allReservations.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-6">Sem reservas registadas.</p>
                ) : (
                  <>
                    {futureReservations.length > 0 && (
                      <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <CalendarClock size={12} className="text-emerald-500" />
                          Próximas ({futureReservations.length})
                        </p>
                        <div className="bg-emerald-50/50 rounded-xl px-3">
                          {futureReservations.map(r => (
                            <ReservationRow key={r.id} r={r} onClick={() => openReservation(r)} />
                          ))}
                        </div>
                      </section>
                    )}
                    {pastReservations.length > 0 && (
                      <section>
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                          <CalendarCheck size={12} className="text-gray-400" />
                          Passadas ({pastReservations.length})
                        </p>
                        <div className="bg-gray-50 rounded-xl px-3">
                          {pastReservations.map(r => (
                            <ReservationRow key={r.id} r={r} onClick={() => openReservation(r)} />
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {resModal?.type === 'detail' && (
        <ReservationDetailModal
          reservation={resModal.r}
          onClose={closeResModal}
          onEdit={() => setResModal({ type: 'edit', r: resModal.r })}
          onChangeStatus={action => setResModal({ type: 'status', r: resModal.r, action })}
          onCancel={() => setResModal({ type: 'status', r: resModal.r, action: 'cancelada' })}
          onCheckout={() => setResModal({ type: 'checkout', r: resModal.r })}
          onEditPayment={() => setResModal({ type: 'checkout', r: resModal.r, editMode: true })}
        />
      )}
      {resModal?.type === 'edit' && (
        <ReservationEditModal
          reservation={resModal.r}
          invalidateKey="client"
          onClose={closeResModal}
          onCancelRequest={() => setResModal({ type: 'status', r: resModal.r, action: 'cancelada' })}
          onOpenCheckout={_pendingForm =>
            setResModal({ type: 'checkout', r: resModal.r, editMode: false })
          }
        />
      )}
      {resModal?.type === 'status' && (
        <ReservationStatusModal
          reservation={resModal.r}
          action={resModal.action}
          invalidateKey="client"
          onClose={closeResModal}
        />
      )}
      {resModal?.type === 'checkout' && (
        <CheckoutModal
          reservation={resModal.r}
          invalidateKey="client"
          onClose={closeResModal}
          editMode={resModal.editMode ?? false}
        />
      )}
    </>
  )
}
