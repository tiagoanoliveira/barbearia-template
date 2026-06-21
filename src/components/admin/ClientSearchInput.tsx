/**
 * ClientSearchInput — componente partilhado de pesquisa de clientes.
 * Usado na criação de reservas (calendar/forms.tsx) e na edição de vendas.
 *
 * A API /api/admin/clients devolve o tipo Client com:
 *   id, name, email, phone, photo_url
 */
import { useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clientsApi } from '@/api/clients'
import type { Client } from '@/types'
import { X } from 'lucide-react'

// ─── Avatar ───────────────────────────────────────────────────────────────────
function ClientAvatar({ client, size = 8 }: { client: Pick<Client, 'name' | 'photo_url'>; size?: number }) {
  const [err, setErr] = useState(false)
  const sz = `w-${size} h-${size}`
  const inicial = client.name?.charAt(0).toUpperCase() ?? '?'
  if (client.photo_url && !err) {
    return (
      <img
        src={client.photo_url}
        alt={client.name}
        className={`${sz} rounded-xl object-cover flex-shrink-0`}
        onError={() => setErr(true)}
      />
    )
  }
  return (
    <div className={`${sz} bg-brand-100 rounded-xl flex items-center justify-center flex-shrink-0`}>
      <span className="text-brand-700 font-semibold text-xs">{inicial}</span>
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
export interface ClientSearchInputProps {
  /** Cliente atualmente selecionado. null = nenhum. */
  selected: Client | null
  /** Chamado quando o utilizador escolhe um cliente da lista. */
  onSelect: (client: Client) => void
  /** Chamado quando o utilizador remove o cliente selecionado. */
  onClear: () => void
  placeholder?: string
  /** Tamanho do avatar quando selecionado (Tailwind units, default 6) */
  avatarSize?: number
}

// ─── Componente principal ─────────────────────────────────────────────────────
export function ClientSearchInput({
  selected,
  onSelect,
  onClear,
  placeholder = 'Pesquisar por nome, email ou telefone...',
  avatarSize = 6,
}: ClientSearchInputProps) {
  const [query, setQuery]     = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [open, setOpen]       = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onType = (v: string) => {
    setQuery(v)
    setOpen(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setDebouncedQ(v), 350)
  }

  const { data, isFetching } = useQuery({
    queryKey: ['client-search-input', debouncedQ],
    queryFn:  () => clientsApi.list({ search: debouncedQ, page: 1, perPage: 10 }),
    enabled:  debouncedQ.trim().length >= 1,
  })

  const results: Client[] = data?.data?.items ?? []
  const noResults = debouncedQ.trim().length > 0 && !isFetching && results.length === 0

  if (selected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-xl">
        <ClientAvatar client={selected} size={avatarSize} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-brand-800 truncate">{selected.name}</p>
          {selected.phone && <p className="text-xs text-brand-500">{selected.phone}</p>}
          {!selected.phone && selected.email && <p className="text-xs text-brand-500">{selected.email}</p>}
        </div>
        <button
          type="button"
          onClick={onClear}
          className="text-brand-400 hover:text-brand-600 flex-shrink-0"
        >
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={e => onType(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        className="input text-sm w-full"
      />
      {open && debouncedQ.trim().length >= 1 && (results.length > 0 || noResults) && (
        <ul className="absolute z-50 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-48 overflow-y-auto">
          {results.map(c => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-brand-50 flex items-center gap-2"
                onMouseDown={e => {
                  e.preventDefault()
                  onSelect(c)
                  setQuery('')
                  setDebouncedQ('')
                  setOpen(false)
                }}
              >
                <ClientAvatar client={c} size={6} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{c.name}</p>
                  <p className="text-xs text-gray-400 truncate">{c.phone ?? c.email ?? ''}</p>
                </div>
              </button>
            </li>
          ))}
          {noResults && (
            <li className="px-3 py-2 text-sm text-gray-400">
              Nenhum cliente encontrado.
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
