import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Users, ChevronRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { clientsApi } from '@/api/clients'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page }],
    queryFn: () => clientsApi.list({ search, page, perPage: 20 }),
    placeholderData: (prev) => prev,
  })

  const clients    = data?.data?.items ?? []
  const total      = data?.data?.total ?? 0
  const totalPages = data?.data?.totalPages ?? 1

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Pesquisar clientes..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="input pl-9"
        />
      </div>

      {/* Lista */}
      <Card padding="none">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum cliente encontrado"
            description="Os clientes aparecem aqui quando fazem a primeira reserva."
          />
        ) : (
          <div className="divide-y divide-gray-50">
            {clients.map(c => (
              <button
                key={c.id}
                onClick={() => navigate(`/admin/clientes/${c.id}`)}
                className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50
                           transition-colors text-left"
              >
                <div className="flex-shrink-0 w-10 h-10 bg-brand-100 rounded-2xl
                                flex items-center justify-center">
                  <span className="text-brand-700 font-semibold text-sm">
                    {c.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-500">
                    {c.phone ?? c.email ?? 'Sem contacto'}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  {c.reservas_concluidas !== undefined && (
                    <p className="text-xs font-medium text-gray-700">
                      {c.reservas_concluidas} visita{c.reservas_concluidas !== 1 ? 's' : ''}
                    </p>
                  )}
                  {c.last_appointment_date && (
                    <p className="text-xs text-gray-400">
                      Última: {format(parseISO(c.last_appointment_date), "d MMM yy", { locale: pt })}
                    </p>
                  )}
                </div>
                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {/* Paginação */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total} clientes</p>
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
