import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Pencil, Eye, Filter, User } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { Reservation } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'
import { hasMeaningfulReservationComment } from '@/utils/reservationComments'
import {
  ReservationDetailModal,
  ReservationEditModal,
  ReservationStatusModal,
  CheckoutModal,
} from '@/components/admin/reservation-modals'
import { ClientDetailModal } from '@/components/admin/client-detail-modal'

const STATUS_OPTIONS = [
  { value: '',           label: 'Todos os estados' },
  { value: 'confirmada', label: 'Confirmadas' },
  { value: 'concluida',  label: 'Concluídas' },
  { value: 'cancelada',  label: 'Canceladas' },
  { value: 'faltou',     label: 'Não vieram' },
]

type ModalMode =
  | { type: 'detail';        r: Reservation }
  | { type: 'edit';          r: Reservation }
  | { type: 'status';        r: Reservation; action: 'faltou' | 'cancelada' }
  | { type: 'checkout';      r: Reservation; editMode?: boolean; pendingEditForm?: Partial<Reservation & { sendEmail: boolean }> }
  | { type: 'client';        clientId: number; clientName: string; clientPhoto?: string }
  | null

function ReservationClientAvatar({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const [err, setErr] = useState(false)
  if (photoUrl && !err) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
      <span className="text-brand-700 text-xs font-bold">{name.charAt(0)}</span>
    </div>
  )
}

export default function ReservationsPage() {
  const adminUser = useAdminUser()
  const isBarber = adminUser?.role === 'barbeiro'
  const loggedBarberId = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : null
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page,   setPage]   = useState(1)
  const [modal,  setModal]  = useState<ModalMode>(null)
  const [barberId, setBarberId] = useState<number | 'all'>(loggedBarberId ?? 'all')

  const today = new Date().toISOString().slice(0, 10)
  const [dateFrom, setDateFrom] = useState(today)
  const [dateTo,   setDateTo]   = useState('')

  const { data: barbersRes } = useQuery({ queryKey: ['barbers'], queryFn: () => barbersApi.list() })

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', { search, status, page, barberId, dateFrom, dateTo }],
    queryFn: () => reservationsApi.list({
      search,
      status,
      page,
      perPage: 20,
      barberId: loggedBarberId ?? (barberId === 'all' ? undefined : barberId),
      fromDate: dateFrom || undefined,
      toDate:   dateTo   || undefined,
    }),
    placeholderData: (prev) => prev,
  })

  const reservations = data?.data?.items ?? []
  const total        = data?.data?.total ?? 0
  const totalPages   = data?.data?.totalPages ?? 1

  const close = () => setModal(null)
  const barbers = barbersRes?.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative w-full sm:max-w-md">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Pesquisar por cliente, serviço..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="input pl-9 text-sm w-full"
            />
          </div>
          <select
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="input sm:w-52 text-sm"
          >
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 items-end">
          <div className="flex items-end gap-2 w-full sm:w-auto">
            <div className="w-full sm:w-48">
              <label className="label flex items-center gap-1 text-xs">
                <Filter size={12} /> Barbeiro
              </label>
              <select
                className="input text-xs w-full"
                value={loggedBarberId ?? (barberId === 'all' ? 'all' : String(barberId))}
                onChange={e => { setBarberId(e.target.value === 'all' ? 'all' : Number(e.target.value)); setPage(1) }}
                disabled={!!loggedBarberId}
              >
                {!loggedBarberId && <option value="all">Todos os barbeiros</option>}
                {barbers.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2 w-full sm:w-64">
              <div className="flex-1">
                <label className="label text-xs">De</label>
                <input
                  type="date"
                  className="input text-xs w-full"
                  value={dateFrom}
                  onChange={e => { setDateFrom(e.target.value); setPage(1) }}
                />
              </div>
              <div className="flex-1">
                <label className="label text-xs">Até</label>
                <input
                  type="date"
                  className="input text-xs w-full"
                  value={dateTo}
                  onChange={e => { setDateTo(e.target.value); setPage(1) }}
                />
              </div>
            </div>
          </div>
        </div>
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
                        <ReservationClientAvatar
                          name={r.client_name}
                          photoUrl={r.client_photo_url}
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {r.created_by === 'online' && <span className="text-blue-600 mr-0.5">@</span>}
                            {hasMeaningfulReservationComment(r.comentario) && <span className="mr-0.5">💬</span>}
                            {r.client_name}
                          </p>
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
                        {r.client_id && !isBarber && (
                          <button
                            onClick={() => setModal({
                              type: 'client',
                              clientId: r.client_id,
                              clientName: r.client_name,
                              clientPhoto: r.client_photo_url,
                            })}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors"
                            title="Ver cliente">
                            <User size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => setModal({ type: 'detail', r })}
                          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600 transition-colors"
                          title="Ver detalhe">
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => setModal({ type: 'edit', r })}
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

      {modal?.type === 'detail' && (
        <ReservationDetailModal
          reservation={modal.r}
          onClose={close}
          onEdit={() => setModal({ type: 'edit', r: modal.r })}
          onChangeStatus={action => setModal({ type: 'status', r: modal.r, action })}
          onCancel={() => setModal({ type: 'status', r: modal.r, action: 'cancelada' })}
          onCheckout={() => setModal({ type: 'checkout', r: modal.r })}
          onEditPayment={() => setModal({ type: 'checkout', r: modal.r, editMode: true })}
        />
      )}

      {modal?.type === 'checkout' && (
        <CheckoutModal
          reservation={modal.r}
          invalidateKey="reservations"
          onClose={close}
          editMode={modal.editMode ?? false}
          pendingEditForm={modal.pendingEditForm}
        />
      )}

      {modal?.type === 'edit' && (
        <ReservationEditModal
          reservation={modal.r}
          invalidateKey="reservations"
          onClose={close}
          onCancelRequest={() => setModal({ type: 'status', r: modal.r, action: 'cancelada' })}
          onOpenCheckout={pendingForm =>
            setModal({ type: 'checkout', r: modal.r, pendingEditForm: pendingForm })
          }
        />
      )}

      {modal?.type === 'status' && (
        <ReservationStatusModal
          reservation={modal.r}
          action={modal.action}
          invalidateKey="reservations"
          onClose={close}
        />
      )}

      {modal?.type === 'client' && (
        <ClientDetailModal
          clientId={modal.clientId}
          initialClient={{ id: modal.clientId, name: modal.clientName, photo_url: modal.clientPhoto }}
          onClose={close}
        />
      )}
    </div>
  )
}
