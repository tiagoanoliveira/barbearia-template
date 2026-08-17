import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, Users, Plus, ChevronRight, Phone, Mail, ShieldAlert } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { clientsApi } from '@/api/clients'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import { ClientDetailModal, ClientCreateModal } from '@/components/admin/client-detail-modal'
import { barberShopConfig } from '@/config/theme'
import type { Client } from '@/types'

const LOYALTY = barberShopConfig.loyalty

const CLIENT_AVATAR_SIZE_CLASS: Record<8 | 16, string> = {
  8: 'w-8 h-8',
  16: 'w-16 h-16',
}

function ClientAvatar({ client, size = 8 }: { client: Client; size?: 8 | 16 }) {
  const sizeClass = CLIENT_AVATAR_SIZE_CLASS[size]
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

function FidelityStamps({ count, everyN }: { count: number; everyN: number }) {
  const progress = (count ?? 0) % everyN
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: everyN }).map((_, i) => (
        <span key={i} className={`inline-block w-2 h-2 rounded-full ${i < progress ? 'bg-brand-500' : 'bg-gray-200'}`} />
      ))}
    </div>
  )
}

export default function ClientsPage() {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Client | null>(null)
  const [blockedFilter, setBlockedFilter] = useState<'all' | 'blocked' | 'unblocked'>('all')
  const [isCreating, setIsCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page, blockedFilter }],
    queryFn:  () => clientsApi.list({
      search,
      page,
      perPage: 20,
      blocked: blockedFilter === 'all' ? undefined : blockedFilter === 'blocked' ? 1 : 0,
    }),
    placeholderData: (prev) => prev,
  })

  const clients    = data?.data?.items ?? []
  const total      = data?.data?.total ?? 0
  const totalPages = data?.data?.totalPages ?? 1

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'd MMM yy', { locale: pt }) } catch { return '—' }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Pesquisar por nome, email ou telefone..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9 w-full"
          />
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          <div className="inline-flex items-center rounded-full bg-gray-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => { setBlockedFilter('all'); setPage(1) }}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                blockedFilter === 'all' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => { setBlockedFilter('unblocked'); setPage(1) }}
              className={`px-3 py-1.5 rounded-full transition-colors ${
                blockedFilter === 'unblocked' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Ativos
            </button>
            <button
              type="button"
              onClick={() => { setBlockedFilter('blocked'); setPage(1) }}
              className={`px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                blockedFilter === 'blocked' ? 'bg-white shadow-sm text-red-700' : 'text-gray-500 hover:text-red-700'
              }`}
            >
              <ShieldAlert size={12} /> Bloqueados
            </button>
          </div>
          <span className="text-sm text-gray-500 whitespace-nowrap">{total} clientes</span>
          <button
              type="button"
              className="btn-primary flex items-center gap-1 text-sm"
              onClick={() => setIsCreating(true)}
          >
            <Plus size={14} />
            Novo cliente
          </button>
        </div>
      </div>

      <Card padding="none">
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>
        ) : clients.length === 0 ? (
          <EmptyState icon={Users} title="Nenhum cliente encontrado"
            description="Os clientes aparecem aqui quando fazem a primeira reserva." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Cliente</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contacto</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Visitas</th>
                  {LOYALTY.enabled && (
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fidelização</th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Última visita</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Próxima reserva</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Cliente desde</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Estado</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map(c => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelected(c)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ClientAvatar client={c} size={8} />
                        <div>
                          <p className="font-medium text-gray-900 flex items-center gap-1.5">
                            {c.name}
                            {c.blocked && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-50 text-[10px] font-semibold text-red-700">
                                <ShieldAlert size={10} /> Bloqueado
                              </span>
                            )}
                          </p>
                          {c.email && <p className="text-xs text-gray-400 md:hidden">{c.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="space-y-0.5">
                        {c.email && <p className="text-xs text-gray-600 flex items-center gap-1"><Mail size={11} className="text-gray-400" />{c.email}</p>}
                        {c.phone && <p className="text-xs text-gray-600 flex items-center gap-1"><Phone size={11} className="text-gray-400" />{c.phone}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center hidden sm:table-cell">
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                        (c.reservas_concluidas ?? 0) >= LOYALTY.everyN ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
                      }`}>{c.reservas_concluidas ?? 0}</span>
                    </td>
                    {LOYALTY.enabled && (
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <FidelityStamps count={c.reservas_concluidas ?? 0} everyN={LOYALTY.everyN} />
                      </td>
                    )}
                    <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{fmtDate(c.last_appointment_date)}</td>
                    <td className="px-4 py-3 text-xs hidden xl:table-cell">
                      {c.next_appointment_date
                        ? <span className="text-emerald-600 font-medium">{fmtDate(c.next_appointment_date)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden xl:table-cell">{fmtDate(c.created_at)}</td>
                    <td className="px-4 py-3 text-xs hidden md:table-cell">
                      {c.blocked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-[11px] font-semibold text-red-700">
                          <ShieldAlert size={10} /> Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-[11px] font-semibold text-emerald-700">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3"><ChevronRight size={14} className="text-gray-400" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{total} clientes</p>
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

      {selected && <ClientDetailModal clientId={selected.id} initialClient={selected} onClose={() => setSelected(null)} />}
      {isCreating && (
          <ClientCreateModal
              onClose={() => setIsCreating(false)}
          />
      )}
    </div>
  )
}
