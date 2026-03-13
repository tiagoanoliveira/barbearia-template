import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Filter, Plus, MoreVertical } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { reservationsApi } from '@/api/reservations'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { ClipboardList } from 'lucide-react'
import type { ReservationStatus } from '@/types'

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Todos os estados' },
  { value: 'pending',   label: 'Pendentes' },
  { value: 'confirmed', label: 'Confirmadas' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'cancelled', label: 'Canceladas' },
  { value: 'no_show',   label: 'Não vieram' },
]

export default function ReservationsPage() {
  const qc = useQueryClient()
  const [search, setSearch]   = useState('')
  const [status, setStatus]   = useState('')
  const [page, setPage]       = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['reservations', { search, status, page }],
    queryFn: () => reservationsApi.list({ search, status, page, perPage: 20 }),
    placeholderData: (prev) => prev,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: ReservationStatus }) =>
      reservationsApi.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  })

  const reservations = data?.data?.items ?? []
  const total        = data?.data?.total ?? 0
  const totalPages   = data?.data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar por cliente, serviço..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="input sm:w-52"
        >
          {STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Tabela */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
        ) : reservations.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nenhuma reserva encontrada"
            description="Tenta ajustar os filtros de pesquisa."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Cliente', 'Serviço', 'Barbeiro', 'Data & Hora', 'Estado', ''].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase
                                          tracking-wide px-5 py-3 first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {reservations.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0">
                          <span className="text-brand-700 text-xs font-bold">
                            {r.client_name.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{r.client_name}</p>
                          {r.client_phone && (
                            <p className="text-xs text-gray-500">{r.client_phone}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-gray-700">{r.service_name}</td>
                    <td className="px-5 py-3 text-sm text-gray-700">{r.barber_name}</td>
                    <td className="px-5 py-3">
                      <p className="text-sm text-gray-900">
                        {format(parseISO(`${r.date}T${r.time}`), "d MMM yyyy", { locale: pt })}
                      </p>
                      <p className="text-xs text-gray-500">{r.time}</p>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => updateStatus.mutate({ id: r.id, status: 'confirmed' })}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700"
                          >
                            Confirmar
                          </button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed') && (
                          <button
                            onClick={() => updateStatus.mutate({ id: r.id, status: 'completed' })}
                            className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                          >
                            Concluir
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {total} reservas no total
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-xs text-gray-600">{page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="btn-secondary text-xs px-3 py-1.5 disabled:opacity-40"
              >
                Seguinte
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
