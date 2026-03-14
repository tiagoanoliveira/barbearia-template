import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckCircle, Calendar } from 'lucide-react'
import { api } from '@/api/client'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ROUTES } from '@/config/routes'
import type { Reservation, Service, Barber } from '@/types'

export default function ReservationsPublicPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const confirmed = params.get('confirmed') === '1'

  const [editing, setEditing] = useState<Reservation | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editServiceId, setEditServiceId] = useState<number | null>(null)
  const [editBarberId, setEditBarberId] = useState<number | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: () => api.get<Reservation[]>('/api/my-reservations'),
    retry: false,
  })

  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get<Service[]>('/api/services'),
  })

  const { data: barbersRes } = useQuery({
    queryKey: ['public-barbers'],
    queryFn: () => api.get<Barber[]>('/api/barbers'),
  })

  const { data: slotsRes } = useQuery({
    queryKey: ['edit-slots', editBarberId, editDate, editServiceId],
    queryFn: () =>
      api.get<string[]>(
        `/api/slots?barber_id=${editBarberId}&date=${editDate}&service_id=${editServiceId}`
      ),
    enabled: !!editing && !!editBarberId && !!editDate && !!editServiceId,
  })

  const services = servicesRes?.data ?? []
  const barbers  = barbersRes?.data ?? []
  const slots    = slotsRes?.data ?? []

  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reservations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-reservations'] }),
  })

  const edit = useMutation({
    mutationFn: async ({ id, date, time, notes, service_id, barber_id }: {
      id: number
      date: string
      time: string
      notes?: string
      service_id?: number
      barber_id?: number
    }) => {
      const res = await api.put(`/api/reservations/${id}`, {
        date,
        time,
        notes: notes || undefined,
        service_id,
        barber_id,
      })
      if (!res.success) {
        throw new Error(res.error ?? 'Erro ao atualizar reserva.')
      }
      return res
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-reservations'] })
      setEditing(null)
    },
    onError: (e: Error) => setEditError(e.message),
  })

  const reservations = data?.data ?? []
  const upcoming     = reservations.filter(r => r.status !== 'cancelada' && r.status !== 'concluida')
  const past         = reservations.filter(r => r.status === 'concluida' || r.status === 'cancelada')

  const openEdit = (r: Reservation) => {
    const dt = parseISO(r.data_hora)
    setEditDate(format(dt, 'yyyy-MM-dd'))
    setEditTime(format(dt, 'HH:mm'))
    setEditNotes(r.comentario ?? '')
    setEditServiceId((r as any).service_id ?? null)
    setEditBarberId((r as any).barber_id ?? null)
    setEditing(r)
    setEditError(null)
  }

  const handleSaveEdit = () => {
    if (!editing) return
    if (!editDate || !editTime || !editServiceId || !editBarberId) {
      setEditError('Serviço, barbeiro, data e hora são obrigatórios.')
      return
    }
    edit.mutate({
      id: editing.id,
      date: editDate,
      time: editTime,
      notes: editNotes,
      service_id: editServiceId,
      barber_id: editBarberId,
    })
  }

  if (isLoading) {
    return (
      <div className="pt-24 flex justify-center py-20">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="pt-24 pb-16 min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 space-y-6">
        {confirmed && (
          <div className="flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/30
                          rounded-2xl px-5 py-4">
            <CheckCircle size={24} className="text-emerald-400 flex-shrink-0" />
            <div>
              <p className="font-semibold text-emerald-400">Reserva confirmada!</p>
              <p className="text-sm text-emerald-300/70">Recebes um email de confirmação em breve.</p>
            </div>
          </div>
        )}

        <h1 className="text-2xl font-black">As minhas reservas</h1>

        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Próximas</h2>
          {upcoming.length === 0 ? (
            <div className="bg-white/5 rounded-2xl p-8 text-center">
              <Calendar size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 mb-4">Ainda não tens reservas futuras.</p>
              <Link
                to={ROUTES.BOOKING}
                className="inline-flex items-center gap-2 px-6 py-3 bg-brand-500
                           text-white font-semibold rounded-xl hover:bg-brand-600 transition-all"
              >
                Reservar agora
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {upcoming.map(r => (
                <ReservationCard
                  key={r.id}
                  r={r}
                  onCancel={() => cancel.mutate(r.id)}
                  onEdit={() => openEdit(r)}
                />
              ))}
            </div>
          )}
        </div>

        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Histórico</h2>
            <div className="space-y-3">
              {past.map(r => (
                <ReservationCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-md border border-white/10 space-y-4">
            <h2 className="text-lg font-semibold text-white">Editar reserva</h2>
            <p className="text-sm text-gray-400 mb-2">
              {editing.service_name} · {editing.barber_name}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Serviço</label>
                <select
                  value={editServiceId ?? ''}
                  onChange={e => {
                    setEditServiceId(Number(e.target.value) || null)
                    setEditTime('')
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecionar serviço</option>
                  {services.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Barbeiro</label>
                <select
                  value={editBarberId ?? ''}
                  onChange={e => {
                    setEditBarberId(Number(e.target.value) || null)
                    setEditTime('')
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Selecionar barbeiro</option>
                  {barbers.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Data</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => {
                    setEditDate(e.target.value)
                    setEditTime('')
                  }}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Hora</label>
                {(!editBarberId || !editServiceId || !editDate) ? (
                  <p className="text-xs text-gray-500">Seleciona primeiro serviço, barbeiro e data.</p>
                ) : slots.length === 0 ? (
                  <p className="text-xs text-gray-500">Sem horários disponíveis para esta combinação.</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-40 overflow-y-auto">
                    {slots.map(slot => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setEditTime(slot)}
                        className={`py-2 rounded-xl text-xs font-medium transition-all ${
                          editTime === slot
                            ? 'bg-brand-500 text-white'
                            : 'bg-white/5 text-gray-300 hover:bg-white/10'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Notas (opcional)</label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={e => setEditNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                />
              </div>
            </div>
            {editError && (
              <p className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl px-3 py-2">
                {editError}
              </p>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => !edit.isPending && setEditing(null)}
                className="px-4 py-2 text-xs text-gray-300 bg-white/5 rounded-xl hover:bg-white/10 transition-colors"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={edit.isPending}
                className="px-4 py-2 text-xs bg-brand-500 text-white rounded-xl hover:bg-brand-600
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {edit.isPending ? 'A guardar...' : 'Guardar alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ReservationCard({ r, onCancel, onEdit }: { r: Reservation; onCancel?: () => void; onEdit?: () => void }) {
  const canCancel = r.status === 'confirmada'
  const canEdit   = canCancel
  const dt = parseISO(r.data_hora)

  const handleCancelClick = () => {
    if (!onCancel) return
    if (window.confirm('Tens a certeza que queres cancelar esta reserva?')) {
      onCancel()
    }
  }

  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex-shrink-0 w-12 h-12 bg-brand-500/20 rounded-2xl flex flex-col
                      items-center justify-center">
        <span className="text-brand-400 font-black text-lg leading-none">{dt.getDate()}</span>
        <span className="text-brand-400/60 text-xs uppercase">
          {format(dt, 'MMM', { locale: pt })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold">{r.service_name}</p>
        <p className="text-sm text-gray-500">
          {r.barber_name} · {format(dt, 'HH:mm')}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <StatusBadge status={r.status} />
        <div className="flex flex-col items-end gap-1 mt-1">
          {canEdit && onEdit && (
            <button
              onClick={onEdit}
              className="px-3 py-1 rounded-full text-xs font-medium bg-brand-500/20 text-brand-200
                         hover:bg-brand-500/30 transition-colors"
            >
              Editar
            </button>
          )}
          {canCancel && onCancel && (
            <button
              onClick={handleCancelClick}
              className="px-3 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-300
                         hover:bg-red-500/20 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
