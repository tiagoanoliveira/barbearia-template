import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Phone, Mail, Calendar,
  Tag, Plus, Edit2, Trash2, X, Save,
  ToggleLeft, ToggleRight,
} from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'

import { clientsApi } from '@/api/clients'
import { reservationsApi } from '@/api/reservations'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Discount } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtValor(d: Discount) {
  if (d.value_percent != null) return `${d.value_percent}%`
  if (d.value_fixed   != null) return `${(d.value_fixed / 100).toFixed(2)} €`
  return '—'
}

function fmtData(iso?: string | null) {
  if (!iso) return null
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: pt }) }
  catch { return iso }
}

const TIPO_BADGE: Record<string, string> = {
  ocasional:   'bg-amber-100 text-amber-700',
  vitalicio:   'bg-emerald-100 text-emerald-700',
  mensal:      'bg-blue-100 text-blue-700',
  fidelizacao: 'bg-purple-100 text-purple-700',
  campanha:    'bg-pink-100 text-pink-700',
  outro:       'bg-gray-100 text-gray-600',
}

const TIPO_OPTIONS = [
  { value: 'ocasional',    label: '🎟️ Ocasional (one-shot)' },
  { value: 'vitalicio',   label: '♾️ Vitalício' },
  { value: 'mensal',      label: '📅 Mensal' },
  { value: 'fidelizacao', label: '⭐ Fidelização' },
  { value: 'campanha',    label: '📢 Campanha' },
  { value: 'outro',       label: '🏷️ Outro' },
]

// ─── Form vazio ────────────────────────────────────────────────────────────────

const emptyForm = (clientId: number) => ({
  id:                   undefined as number | undefined,
  cliente_id:           clientId,
  nome:                 '',
  descricao:            '',
  tipo:                 'ocasional',
  valor_percentagem:    null as number | null,
  valor_fixo_centimos:  null as number | null,
  valido_de:            '',
  valido_ate:           '',
  max_usos:             1 as number | null,
  ativo:                true,
})
type DiscountForm = ReturnType<typeof emptyForm>

// ─── Modal de criação / edição ────────────────────────────────────────────────

function DiscountModal({
  initial, onClose, onSave, saving,
}: {
  initial: DiscountForm
  onClose: () => void
  onSave: (form: DiscountForm) => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const upd = <K extends keyof DiscountForm>(k: K, v: DiscountForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleTipoChange = (tipo: string) => {
    setForm(f => ({ ...f, tipo, max_usos: tipo === 'ocasional' ? 1 : null }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.nome.trim())  { setError('O nome é obrigatório.'); return }
    if (!form.tipo.trim())  { setError('O tipo é obrigatório.'); return }
    if (form.valor_percentagem == null && form.valor_fixo_centimos == null) {
      setError('Indica um valor (percentagem ou valor fixo).'); return
    }
    onSave(form)
  }

  const isEditing = !!initial.id

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {isEditing ? '✏️ Editar desconto' : '➕ Novo desconto'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="label">Nome <span className="text-red-500">*</span></label>
            <input type="text" className="input w-full"
              value={form.nome} onChange={e => upd('nome', e.target.value)}
              placeholder="Ex.: Desconto de aniversário" />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea rows={2} className="input w-full resize-none"
              value={form.descricao} onChange={e => upd('descricao', e.target.value)}
              placeholder="Opcional — aparece no perfil do cliente" />
          </div>

          <div>
            <label className="label">Tipo <span className="text-red-500">*</span></label>
            <select className="input text-sm w-full bg-white"
              value={form.tipo} onChange={e => handleTipoChange(e.target.value)}>
              {TIPO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Desconto em % </label>
              <input type="number" min={0} max={100} step={1} className="input w-full"
                value={form.valor_percentagem ?? ''}
                onChange={e => upd('valor_percentagem', e.target.value ? Number(e.target.value) : null)}
                placeholder="Ex.: 10" />
            </div>
            <div>
              <label className="label">Valor fixo (€)</label>
              <input type="number" min={0} step={0.5} className="input w-full"
                value={form.valor_fixo_centimos != null ? (form.valor_fixo_centimos / 100) : ''}
                onChange={e => upd('valor_fixo_centimos', e.target.value ? Math.round(Number(e.target.value) * 100) : null)}
                placeholder="Ex.: 5.00" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Válido de</label>
              <input type="date" className="input w-full"
                value={form.valido_de} onChange={e => upd('valido_de', e.target.value)} />
            </div>
            <div>
              <label className="label">Válido até</label>
              <input type="date" className="input w-full"
                value={form.valido_ate} onChange={e => upd('valido_ate', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="label">Máximo de usos</label>
            <input type="number" min={1} step={1} className="input w-full"
              value={form.max_usos ?? ''}
              onChange={e => upd('max_usos', e.target.value ? Number(e.target.value) : null)}
              placeholder="Deixa vazio para ilimitado (vitalício)" />
            <p className="text-xs text-gray-400 mt-1">1 = ocasional (one-shot) · vazio = ilimitado</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="rounded"
              checked={form.ativo} onChange={e => upd('ativo', e.target.checked)} />
            <span className="text-sm font-medium">Desconto ativo</span>
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={14} />
              {saving ? 'A guardar...' : isEditing ? 'Guardar alterações' : 'Criar desconto'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Bloco de descontos do cliente ────────────────────────────────────────────

function ClientDiscountsBlock({ clientId }: { clientId: number }) {
  const qc = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing]     = useState<DiscountForm | null>(null)
  const [saving, setSaving]       = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['client-discounts', clientId],
    queryFn: () => adminApi.get<any[]>(`/api/discounts/client/${clientId}`),
    enabled: !!clientId,
  })

  const rawDiscounts: any[] = (data as any)?.data ?? []
  const discounts: Discount[] = rawDiscounts.map((d: any) => ({
    id:                       d.id,
    client_id:                d.cliente_id ?? null,
    name:                     d.nome,
    description:              d.descricao,
    type:                     d.tipo,
    origin:                   d.origem,
    value_percent:            d.valor_percentagem,
    value_fixed:              d.valor_fixo_centimos,
    valid_from:               d.valido_de,
    valid_to:                 d.valido_ate,
    min_monthly_reservations: d.min_reservas_mes,
    max_uses:                 d.max_usos,
    used_count:               d.usos_feitos ?? 0,
    last_used_at:             d.usado_ultima_vez_em,
    last_used_reservation_id: d.usado_ultima_reserva_id,
    usage_comment:            d.comentario_uso,
    active:                   !!d.ativo,
    created_by_admin_id:      d.criado_por_admin_id,
    created_at:               d.criado_em,
    updated_at:               d.atualizado_em,
  }))

  const handleSave = async (form: DiscountForm) => {
    setSaving(true)
    try {
      const payload = {
        cliente_id:          form.cliente_id,
        nome:                form.nome,
        descricao:           form.descricao || null,
        tipo:                form.tipo,
        origem:              'manual',
        valor_percentagem:   form.valor_percentagem,
        valor_fixo_centimos: form.valor_fixo_centimos,
        valido_de:           form.valido_de   || null,
        valido_ate:          form.valido_ate  || null,
        max_usos:            form.max_usos,
        ativo:               form.ativo,
      }
      if (form.id) {
        await adminApi.put(`/api/discounts/${form.id}`, payload)
      } else {
        await adminApi.post('/api/discounts', payload)
      }
      qc.invalidateQueries({ queryKey: ['client-discounts', clientId] })
      setModalOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tens a certeza que queres eliminar este desconto?')) return
    await adminApi.delete(`/api/discounts/${id}`)
    qc.invalidateQueries({ queryKey: ['client-discounts', clientId] })
  }

  const handleToggleAtivo = async (d: Discount) => {
    await adminApi.put(`/api/discounts/${d.id}`, { ativo: !d.active })
    qc.invalidateQueries({ queryKey: ['client-discounts', clientId] })
  }

  const openNew = () => {
    setEditing(emptyForm(clientId))
    setModalOpen(true)
  }

  const openEdit = (d: Discount) => {
    setEditing({
      id:                   d.id,
      cliente_id:           clientId,
      nome:                 d.name,
      descricao:            d.description ?? '',
      tipo:                 d.type,
      valor_percentagem:    d.value_percent ?? null,
      valor_fixo_centimos:  d.value_fixed   ?? null,
      valido_de:            d.valid_from    ? d.valid_from.slice(0, 10) : '',
      valido_ate:           d.valid_to      ? d.valid_to.slice(0, 10)   : '',
      max_usos:             d.max_uses ?? null,
      ativo:                d.active,
    })
    setModalOpen(true)
  }

  return (
    <Card padding="none">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Tag size={14} className="text-brand-500" /> Descontos exclusivos
          </h3>
          <p className="text-xs text-gray-500">{discounts.length} desconto{discounts.length !== 1 ? 's' : ''} associado{discounts.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openNew} className="btn-primary text-xs flex items-center gap-1.5">
          <Plus size={13} /> Novo
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><LoadingSpinner /></div>
      ) : discounts.length === 0 ? (
        <p className="text-center text-sm text-gray-400 py-8">Sem descontos associados a este cliente.</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {discounts.map(d => {
            const tipoClass = TIPO_BADGE[d.type] ?? TIPO_BADGE.outro
            return (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tipoClass}`}>
                      {d.type}
                    </span>
                    {!d.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">
                        inativo
                      </span>
                    )}
                  </div>
                  {d.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">{d.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 mt-1 text-xs text-gray-500">
                    <span className="font-semibold text-gray-700">{fmtValor(d)}</span>
                    <span>
                      {d.max_uses == null
                        ? '∞ usos'
                        : `${d.used_count} / ${d.max_uses} uso${d.max_uses !== 1 ? 's' : ''}`
                      }
                    </span>
                    {(d.valid_from || d.valid_to) && (
                      <span>
                        {fmtData(d.valid_from)} {d.valid_from && d.valid_to ? '→' : ''} {fmtData(d.valid_to)}
                      </span>
                    )}
                    {d.usage_comment && (
                      <span className="italic text-gray-400 truncate max-w-[200px]" title={d.usage_comment}>
                        💬 {d.usage_comment}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleToggleAtivo(d)}
                    title={d.active ? 'Desativar' : 'Ativar'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      d.active
                        ? 'text-emerald-500 hover:bg-emerald-50'
                        : 'text-gray-400 hover:bg-gray-100'
                    }`}
                  >
                    {d.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                  </button>
                  <button
                    onClick={() => openEdit(d)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => handleDelete(d.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modalOpen && editing && (
        <DiscountModal
          initial={editing}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </Card>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

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

      {/* Descontos exclusivos */}
      <ClientDiscountsBlock clientId={clientId} />

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
