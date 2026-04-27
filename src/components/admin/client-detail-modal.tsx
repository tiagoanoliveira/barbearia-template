import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format, formatDistanceToNow, parseISO, isFuture, isPast } from 'date-fns'
import { pt } from 'date-fns/locale'
import { Mail, Pencil, Phone, Star, CalendarClock, CalendarCheck } from 'lucide-react'
import { clientsApi } from '@/api/clients'
import Modal from '@/components/ui/Modal'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { StatusBadge } from '@/components/ui/Badge'
import type { Client } from '@/types'

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
  next_appointment_date?: string
  last_appointment_date?: string
  reservations?: ClientReservation[]
}

type ClientReservation = {
  id: number
  data_hora: string
  status: string
  service_name: string
  barber_name: string
  service_price?: number
  comentario?: string
}

type Tab = 'info' | 'reservations'

function ClientAvatar({ client, size = 16 }: { client: ClientModalData; size?: 8 | 16 }) {
  const sizeClass = size === 16 ? 'w-16 h-16' : 'w-8 h-8'
  const [imgError, setImgError] = useState(false)
  useEffect(() => { setImgError(false) }, [client.photo_url])
  if (client.photo_url && !imgError) {
    return (
      <img
        src={client.photo_url}
        alt={client.name}
        className={`${sizeClass} rounded-xl object-cover flex-shrink-0`}
        onError={() => setImgError(true)}
      />
    )
  }
  return (
    <div className={`${sizeClass} bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand-700 font-semibold text-xs">{client.name.charAt(0).toUpperCase()}</span>
    </div>
  )
}

function FidelityStamps({ count }: { count: number }) {
  const stamps = (count ?? 0) % 10
  const full = Math.floor((count ?? 0) / 10)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`inline-block w-2 h-2 rounded-full ${i < stamps ? 'bg-brand-500' : 'bg-gray-200'}`} />
      ))}
      {full > 0 && <span className="text-[10px] text-brand-600 font-semibold ml-1">{full}× 🎁</span>}
    </div>
  )
}

function ReservationRow({ r }: { r: ClientReservation }) {
  const fmtDt = (iso: string) => {
    try { return format(parseISO(iso), "d MMM yyyy 'às' HH:mm", { locale: pt }) } catch { return iso }
  }
  return (
    <div className="flex items-start justify-between gap-2 py-2.5 border-b border-gray-50 last:border-0">
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
    </div>
  )
}

export function ClientDetailModal({
  clientId,
  initialClient,
  onClose,
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
  const [clientData, setClientData] = useState<ClientModalData | null>(currentClient)
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('info')
  const [form, setForm] = useState({
    name: currentClient?.name ?? '',
    email: currentClient?.email ?? '',
    phone: currentClient?.phone ?? '',
    nif: currentClient?.nif ? String(currentClient.nif) : '',
    notes: currentClient?.notes ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    setClientData(currentClient)
    setForm({
      name: currentClient?.name ?? '',
      email: currentClient?.email ?? '',
      phone: currentClient?.phone ?? '',
      nif: currentClient?.nif ? String(currentClient.nif) : '',
      notes: currentClient?.notes ?? '',
    })
    setEditMode(false)
    setSaveError(null)
  }, [currentClient])

  const deleteM = useMutation({
    mutationFn: () => clientsApi.delete(clientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      onClose()
    },
  })

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    try {
      const res = await clientsApi.update(clientId, {
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        nif: form.nif ? Number(form.nif) : undefined,
        notes: form.notes || undefined,
      })
      if (!res.success || !res.data) throw new Error(res.error ?? 'Não foi possível guardar as alterações.')
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['client', clientId] })
      setClientData(res.data as Client)
      setEditMode(false)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : 'Não foi possível guardar as alterações.')
    } finally {
      setSaving(false)
    }
  }

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'd MMM yyyy', { locale: pt }) } catch { return '—' }
  }
  const fmtAgo = (iso?: string) => {
    if (!iso) return null
    try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt }) } catch { return null }
  }

  // Separar reservas passadas / futuras
  const allReservations: ClientReservation[] = clientData?.reservations ?? []
  const futureReservations = allReservations.filter(r => isFuture(parseISO(r.data_hora)))
  const pastReservations   = allReservations.filter(r => isPast(parseISO(r.data_hora)))

  if (!clientData) {
    return (
      <Modal open={true} onClose={onClose} title="Cliente">
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      </Modal>
    )
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={editMode ? `Editar ${clientData.name}` : clientData.name}
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
              <button onClick={() => setEditMode(true)} className="btn-secondary"><Pencil size={14} className="inline mr-1" />Editar</button>
              <button onClick={onClose} className="btn-secondary">Fechar</button>
            </>
      }
    >
      {editMode ? (
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => { setForm(f => ({...f, name: e.target.value})); setSaveError(null) }} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => { setForm(f => ({...f, email: e.target.value})); setSaveError(null) }} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefone</label>
            <input type="tel" value={form.phone} onChange={e => { setForm(f => ({...f, phone: e.target.value})); setSaveError(null) }} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">NIF</label>
            <input type="text" value={form.nif} onChange={e => { setForm(f => ({...f, nif: e.target.value})); setSaveError(null) }} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notas internas</label>
            <textarea rows={3} value={form.notes} onChange={e => { setForm(f => ({...f, notes: e.target.value})); setSaveError(null) }}
              className="input text-sm w-full resize-none" />
          </div>
          {saveError && <p className="text-xs text-red-500">{saveError}</p>}
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* Cabeçalho com avatar */}
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <ClientAvatar client={clientData} size={16} />
            <div>
              <p className="font-semibold text-gray-900 text-base">{clientData.name}</p>
              {clientData.email && <p className="text-xs text-gray-500">{clientData.email}</p>}
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('info')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'info' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Star size={12} /> Informações
            </button>
            <button
              onClick={() => setActiveTab('reservations')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'reservations' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <CalendarClock size={12} /> Reservas
              {allReservations.length > 0 && (
                <span className="bg-brand-100 text-brand-700 text-[10px] font-bold px-1.5 rounded-full">
                  {allReservations.length}
                </span>
              )}
            </button>
          </div>

          {/* Tab: Informações */}
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
              <section>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fidelização</p>
                <div className="flex items-center gap-3">
                  <Star size={14} className="text-amber-500" />
                  <span>{clientData.reservas_concluidas ?? 0} visitas no total</span>
                </div>
                <div className="mt-2">
                  <FidelityStamps count={clientData.reservas_concluidas ?? 0} />
                  <p className="text-xs text-gray-400 mt-1">
                    {10 - ((clientData.reservas_concluidas ?? 0) % 10)} visitas para o próximo corte grátis
                  </p>
                </div>
              </section>
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
              {clientData.notes && (
                <section>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</p>
                  <p className="text-xs bg-amber-50 rounded-lg px-3 py-2 text-amber-800">{clientData.notes}</p>
                </section>
              )}
              <p className="text-xs text-gray-400">Cliente desde {fmtDate(clientData.created_at)}</p>
            </>
          )}

          {/* Tab: Reservas */}
          {activeTab === 'reservations' && (
            <div className="space-y-4">
              {allReservations.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">Sem reservas registadas.</p>
              ) : (
                <>
                  {/* Futuras */}
                  {futureReservations.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CalendarClock size={12} className="text-emerald-500" />
                        Próximas ({futureReservations.length})
                      </p>
                      <div className="bg-emerald-50/50 rounded-xl px-3">
                        {futureReservations.map(r => <ReservationRow key={r.id} r={r} />)}
                      </div>
                    </section>
                  )}

                  {/* Passadas */}
                  {pastReservations.length > 0 && (
                    <section>
                      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                        <CalendarCheck size={12} className="text-gray-400" />
                        Passadas ({pastReservations.length})
                      </p>
                      <div className="bg-gray-50 rounded-xl px-3">
                        {pastReservations.map(r => <ReservationRow key={r.id} r={r} />)}
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
  )
}
