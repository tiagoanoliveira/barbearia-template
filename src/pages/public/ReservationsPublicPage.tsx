import { useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { CheckCircle, CalendarX, Calendar } from 'lucide-react'
import { api } from '@/api/client'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ROUTES } from '@/config/routes'
import type { Reservation } from '@/types'

export default function ReservationsPublicPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [params] = useSearchParams()
  const confirmed = params.get('confirmed') === '1'

  const { data, isLoading } = useQuery({
    queryKey: ['my-reservations'],
    queryFn: () => api.get<Reservation[]>('/api/my-reservations'),
    retry: false,
  })

  const cancel = useMutation({
    mutationFn: (id: number) => api.delete(`/api/reservations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-reservations'] }),
  })

  const reservations = data?.data ?? []
  const upcoming     = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed')
  const past         = reservations.filter(r => r.status === 'completed' || r.status === 'cancelled')

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
        {/* Banner sucesso */}
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

        {/* Próximas */}
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Próximas
          </h2>
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
                <ReservationCard key={r.id} r={r} onCancel={() => cancel.mutate(r.id)} />
              ))}
            </div>
          )}
        </div>

        {/* Histórico */}
        {past.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
              Histórico
            </h2>
            <div className="space-y-3">
              {past.map(r => (
                <ReservationCard key={r.id} r={r} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ReservationCard({ r, onCancel }: { r: Reservation; onCancel?: () => void }) {
  const canCancel = r.status === 'pending' || r.status === 'confirmed'
  return (
    <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4">
      <div className="flex-shrink-0 w-12 h-12 bg-brand-500/20 rounded-2xl flex flex-col
                      items-center justify-center">
        <span className="text-brand-400 font-black text-lg leading-none">
          {parseISO(`${r.date}T${r.time}`).getDate()}
        </span>
        <span className="text-brand-400/60 text-xs uppercase">
          {format(parseISO(`${r.date}T${r.time}`), 'MMM', { locale: pt })}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold">{r.service_name}</p>
        <p className="text-sm text-gray-500">
          {r.barber_name} ·{' '}
          {format(parseISO(`${r.date}T${r.time}`), "HH:mm")}
        </p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusBadge status={r.status} />
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
