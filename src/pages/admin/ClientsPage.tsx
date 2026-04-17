import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Users, ChevronRight, Phone, Mail, Star, Pencil } from 'lucide-react'
import { format, parseISO, formatDistanceToNow } from 'date-fns'
import { pt } from 'date-fns/locale'

import { clientsApi } from '@/api/clients'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import EmptyState from '@/components/ui/EmptyState'
import Modal from '@/components/ui/Modal'
import type { Client } from '@/types'

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

function FidelityStamps({ count }: { count: number }) {
  const stamps = (count ?? 0) % 10
  const full   = Math.floor((count ?? 0) / 10)
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <span key={i} className={`inline-block w-2 h-2 rounded-full ${i < stamps ? 'bg-brand-500' : 'bg-gray-200'}`} />
      ))}
      {full > 0 && <span className="text-[10px] text-brand-600 font-semibold ml-1">{full}× 🎁</span>}
    </div>
  )
}

function ClientDetailModal({ client, onClose }: { client: Client; onClose: () => void }) {
  const qc = useQueryClient()
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({
    name:  client.name,
    email: client.email ?? '',
    phone: client.phone ?? '',
    nif:   client.nif ? String(client.nif) : '',
    notes: client.notes ?? '',
  })
  const [saving, setSaving] = useState(false)

  const deleteM = useMutation({
    mutationFn: () => clientsApi.delete(client.id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['clients'] }); onClose() },
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await clientsApi.update(client.id, {
        name:  form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        nif:   form.nif ? Number(form.nif) : undefined,
        notes: form.notes || undefined,
      })
      qc.invalidateQueries({ queryKey: ['clients'] })
      setEditMode(false)
    } catch {}
    finally { setSaving(false) }
  }

  const fmtDate = (iso?: string) => {
    if (!iso) return '—'
    try { return format(parseISO(iso), 'd MMM yyyy', { locale: pt }) } catch { return '—' }
  }
  const fmtAgo = (iso?: string) => {
    if (!iso) return null
    try { return formatDistanceToNow(parseISO(iso), { addSuffix: true, locale: pt }) } catch { return null }
  }

  return (
    <Modal open={true} onClose={onClose} title={editMode ? `Editar ${client.name}` : client.name}
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
                onClick={() => { if (window.confirm(`Eliminar "${client.name}"? Esta acção é irreversível.`)) deleteM.mutate() }}
                disabled={deleteM.isPending}
                className="text-xs text-red-500 hover:text-red-700 mr-auto disabled:opacity-50">
                {deleteM.isPending ? 'A eliminar...' : '🗑️ Eliminar'}
              </button>
              <button onClick={() => setEditMode(true)} className="btn-secondary"><Pencil size={14} className="inline mr-1" />Editar</button>
              <button onClick={onClose} className="btn-secondary">Fechar</button>
            </>
      }>
      {editMode ? (
        <div className="space-y-3 text-sm">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Nome <span className="text-red-400">*</span></label>
            <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Telefone</label>
            <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">NIF</label>
            <input type="text" value={form.nif} onChange={e => setForm(f => ({...f, nif: e.target.value}))} className="input text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notas internas</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))}
              className="input text-sm w-full resize-none" />
          </div>
        </div>
      ) : (
        <div className="space-y-4 text-sm">
          {/* Avatar grande no topo do modal */}
          <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
            <ClientAvatar client={client} size={16} />
            <div>
              <p className="font-semibold text-gray-900 text-base">{client.name}</p>
              {client.email && <p className="text-xs text-gray-500">{client.email}</p>}
            </div>
          </div>

          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Contactos</p>
            <div className="space-y-1.5">
              {client.email && (
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-gray-400" />
                  <a href={`mailto:${client.email}`} className="text-brand-600 hover:underline">{client.email}</a>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2">
                  <Phone size={14} className="text-gray-400" />
                  <a href={`tel:${client.phone}`} className="text-brand-600 hover:underline">{client.phone}</a>
                </div>
              )}
              {client.nif && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-xs">NIF</span>
                  <span>{client.nif}</span>
                </div>
              )}
            </div>
          </section>
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Fidelização</p>
            <div className="flex items-center gap-3">
              <Star size={14} className="text-amber-500" />
              <span>{client.reservas_concluidas ?? 0} visitas no total</span>
            </div>
            <div className="mt-2">
              <FidelityStamps count={client.reservas_concluidas ?? 0} />
              <p className="text-xs text-gray-400 mt-1">
                {10 - ((client.reservas_concluidas ?? 0) % 10)} visitas para o próximo corte grátis
              </p>
            </div>
          </section>
          <section>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reservas</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500">Última visita</p>
                <p className="font-medium">
                  {fmtDate(client.last_appointment_date)}
                  {fmtAgo(client.last_appointment_date) && (
                    <span className="text-gray-400"> ({fmtAgo(client.last_appointment_date)})</span>
                  )}
                </p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-gray-500">Próxima reserva</p>
                <p className="font-medium">{fmtDate(client.next_appointment_date)}</p>
              </div>
            </div>
          </section>
          {client.notes && (
            <section>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notas</p>
              <p className="text-xs bg-amber-50 rounded-lg px-3 py-2 text-amber-800">{client.notes}</p>
            </section>
          )}
          <p className="text-xs text-gray-400">Cliente desde {fmtDate(client.created_at)}</p>
        </div>
      )}
    </Modal>
  )
}

export default function ClientsPage() {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState<Client | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['clients', { search, page }],
    queryFn:  () => clientsApi.list({ search, page, perPage: 20 }),
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
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Pesquisar por nome, email ou telefone..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="input pl-9 w-full" />
        </div>
        <span className="text-sm text-gray-500 whitespace-nowrap">{total} clientes</span>
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
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fidelização</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Última visita</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Próxima reserva</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Cliente desde</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {clients.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelected(c)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ClientAvatar client={c} size={8} />
                        <div>
                          <p className="font-medium text-gray-900">{c.name}</p>
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
                        (c.reservas_concluidas ?? 0) >= 10 ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'
                      }`}>{c.reservas_concluidas ?? 0}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell"><FidelityStamps count={c.reservas_concluidas ?? 0} /></td>
                    <td className="px-4 py-3 text-xs text-gray-600 hidden lg:table-cell">{fmtDate(c.last_appointment_date)}</td>
                    <td className="px-4 py-3 text-xs hidden xl:table-cell">
                      {c.next_appointment_date
                        ? <span className="text-emerald-600 font-medium">{fmtDate(c.next_appointment_date)}</span>
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden xl:table-cell">{fmtDate(c.created_at)}</td>
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

      {selected && <ClientDetailModal client={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
