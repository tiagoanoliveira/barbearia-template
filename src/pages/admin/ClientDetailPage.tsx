import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Phone, Mail, Calendar } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { clientsApi } from '@/api/clients'
import { reservationsApi } from '@/api/reservations'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const clientId = Number(id)

  const { data: clientRes, isLoading: clientLoading } = useQuery({
    queryKey: ['client', clientId],
    queryFn: () => clientsApi.get(clientId),
    enabled: !!clientId,
  })

  const { data: reservsRes, isLoading: reservsLoading } = useQuery({
    queryKey: ['client-reservations', clientId],
    queryFn: () => reservationsApi.list({ perPage: 50 }),
    enabled: !!clientId,
  })

  const client = clientRes?.data
  const reservations = (reservsRes?.data?.items ?? []).filter(r => r.client_id === clientId)

  if (clientLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  if (!client) {
    return <p className="text-center text-gray-500 py-20">Cliente não encontrado.</p>
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={16} /> Voltar
      </button>

      {/* Perfil */}
      <Card>
        <div className="flex items-start gap-5">
          {client.photo_url ? (
            <img src={client.photo_url} alt={client.name} className="flex-shrink-0 w-16 h-16 rounded-2xl object-cover" />
          ) : (
            <div className="flex-shrink-0 w-16 h-16 bg-brand-100 rounded-2xl
                            flex items-center justify-center text-brand-700 text-2xl font-bold">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{client.name}</h2>
            <div className="flex flex-wrap gap-4 mt-2">
              {client.phone && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Phone size={14} className="text-gray-400" />{client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1.5 text-sm text-gray-600">
                  <Mail size={14} className="text-gray-400" />{client.email}
                </span>
              )}
              <span className="flex items-center gap-1.5 text-sm text-gray-600">
                <Calendar size={14} className="text-gray-400" />
                Cliente desde {format(parseISO(client.created_at), "MMM yyyy", { locale: pt })}
              </span>
            </div>
            {client.notes && (
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-xl px-3 py-2">
                {client.notes}
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Histórico de reservas */}
      <Card padding="none">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">Histórico de reservas</h3>
          <p className="text-xs text-gray-500">{reservations.length} marcações no total</p>
        </div>
        {reservsLoading ? (
          <div className="flex justify-center py-8"><LoadingSpinner /></div>
        ) : reservations.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-8">Sem reservas registadas.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {reservations.map(r => (
              <div key={r.id} className="flex items-center gap-4 px-5 py-3">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{r.service_name}</p>
                  <p className="text-xs text-gray-500">{r.barber_name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-gray-700">
                    {format(parseISO(r.data_hora), "d MMM yyyy, HH:mm", { locale: pt })}
                  </p>
                  <StatusBadge status={r.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
