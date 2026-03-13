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
import type { Reservation } from '@/types'

export default function ReservationsPublicPage() {
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const confirmed = params.get('confirmed') === '1'

  const [editing, setEditing] = useState<Reservation | null>(null)
  const [editDate, setEditDate] = useState('')
  const [editTime, setEditTime] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [editError, setEditError] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: () => api.get<Reservation[]>('/api/my-reservations'),
    retry: false,
  })

  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reservations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-reservations'] }),
  })

  const edit = useMutation({
    mutationFn: async ({ id, date, time, notes }: { id: number; date: string; time: string; notes?: string }) => {
      const res = await api.put(`/api/reservations/${id}`, {
        date,
        time,
        notes: notes || undefined,
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
    setEditing(r)
    setEditError(null)
  }

  const handleSaveEdit = () => {
    if (!editing) return
    if (!editDate || !editTime) {
      setEditError('Data e hora são obrigatórias.')
      return
    }
    edit.mutate({ id: editing.id, date: editDate, time: editTime, notes: editNotes })
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
            <p className="text-sm text-gray-400">
              {editing.service_name} · {editing.barber_name}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Data</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">Hora</label>
                <input
                  type="time"
                  value={editTime}
                  onChange={e => setEditTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm
                             text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
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
  const canCancel = r.status === 'pendente' || r.status === 'confirmada'
  const canEdit   = canCancel
  const dt = parseISO(r.data_hora)
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
        {canEdit && onEdit && (
          <button
            onClick={onEdit}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            Editar
          </button>
        )}
        {canCancel && onCancel && (
          <button
            onClick={onCancel}
            className="text-xs text-red-400 hover:text-red-300 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  )
}
