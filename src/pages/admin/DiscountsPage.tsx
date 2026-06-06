/**
 * DiscountsPage — Gestão de descontos (apenas superAdmin).
 *
 * Permite:
 *  - Criar descontos gerais (sem cliente) ou exclusivos (por cliente)
 *  - Criar descontos ocasionais (max_usos=1), vitalícios (max_usos=null) ou mensais
 *  - Editar / desativar descontos existentes
 *  - Filtrar por tipo, estado (ativo/inativo) e cliente
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Edit2, Trash2, Tag, Users, User, X, Save, ToggleLeft, ToggleRight } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { adminApi } from '@/api/client'
import { clientsApi } from '@/api/clients'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { isSuperAdmin, useAdminUser } from '@/hooks/useAdminUser'
import type { Discount, Client } from '@/types'

const API = '/api/admin/discounts'

// ─── Helpers ───────────────────────────────────────────────────────────────────────────────
function fmtValor(d: Discount) {
  if (d.value_percent != null) return `${d.value_percent}%`
  if (d.value_fixed  != null) return `${(d.value_fixed / 100).toFixed(2)} €`
  return '—'
}

function fmtData(iso?: string | null) {
  if (!iso) return null
  try { return format(parseISO(iso), 'd MMM yyyy', { locale: pt }) }
  catch { return iso }
}

const TIPO_OPTIONS = [
  { value: 'ocasional',    label: '\uD83C\uDF9F\uFE0F Ocasional (one-shot)' },
  { value: 'vitalicio',   label: '\u267E\uFE0F Vitalício' },
  { value: 'mensal',      label: '\uD83D\uDCC5 Mensal' },
  { value: 'quantidade',  label: '\uD83D\uDCC8 Por quantidade' },
  { value: 'servico',     label: '\u2702\uFE0F Por serviço' },
  { value: 'fidelizacao', label: '\u2B50 Fidelização' },
  { value: 'campanha',    label: '\uD83D\uDCE2 Campanha' },
  { value: 'outro',       label: '\uD83C\uDFF7\uFE0F Outro' },
]

const PERIODO_OPTIONS = [
  { value: 'semana',    label: 'Semana (7 dias)' },
  { value: 'quinzena',  label: 'Quinzena (15 dias)' },
  { value: 'mes',       label: 'Mês (mês atual)' },
  { value: 'trimestre', label: 'Trimestre (3 meses)' },
  { value: 'semestre',  label: 'Semestre (6 meses)' },
  { value: 'ano',       label: 'Ano (12 meses)' },
]

const TIPO_BADGE: Record<string, string> = {
  ocasional:   'bg-amber-100 text-amber-700',
  vitalicio:   'bg-emerald-100 text-emerald-700',
  mensal:      'bg-blue-100 text-blue-700',
  quantidade:  'bg-indigo-100 text-indigo-700',
  servico:     'bg-teal-100 text-teal-700',
  fidelizacao: 'bg-purple-100 text-purple-700',
  campanha:    'bg-pink-100 text-pink-700',
  outro:       'bg-gray-100 text-gray-600',
}

// ─── Formulário vazio ───────────────────────────────────────────────────────────────────────────
const emptyForm = () => ({
  cliente_id:           null as number | null,
  nome:                 '',
  descricao:            '',
  tipo:                 'ocasional',
  valor_percentagem:    null as number | null,
  valor_fixo_centimos:  null as number | null,
  valido_de:            '',
  valido_ate:           '',
  min_reservas:         null as number | null,
  min_reservas_periodo: null as string | null,
  grupo:                null as string | null,
  regra_tipo:           null as string | null,
  regra_detalhe:        null as string | null,
  max_usos:             1 as number | null,
  ativo:                true,
})
type DiscountForm = ReturnType<typeof emptyForm>

// ─── Modal de criação/edição ────────────────────────────────────────────────────────────────────
function DiscountModal({
  initial,
  clients,
  clientSearch,
  onClientSearch,
  onClose,
  onSave,
  saving,
}: {
  initial: DiscountForm & { id?: number }
  clients: Client[]
  clientSearch: string
  onClientSearch: (v: string) => void
  onClose: () => void
  onSave: (form: DiscountForm & { id?: number }) => void
  saving: boolean
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const upd = <K extends keyof DiscountForm>(k: K, v: DiscountForm[K]) =>
    setForm(f => ({ ...f, [k]: v }))

  const handleTipoChange = (tipo: string) => {
    const maxUsos = tipo === 'ocasional' ? 1 : null
    setForm(f => ({ ...f, tipo, max_usos: maxUsos }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.nome.trim()) { setError('O nome é obrigatório.'); return }
    if (!form.tipo.trim()) { setError('O tipo é obrigatório.'); return }
    if (form.valor_percentagem == null && form.valor_fixo_centimos == null) {
      setError('Indica um valor (percentagem ou valor fixo).'); return
    }
    onSave(form)
  }

  const isEditing = !!initial.id
  const showQuantidade = ['quantidade', 'mensal'].includes(form.tipo)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-y-auto max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">
            {isEditing ? '\u270F\uFE0F Editar desconto' : '\u2795 Novo desconto'}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">

          {/* Seletor de cliente com pesquisa */}
          <div>
            <label className="label">Cliente</label>
            <input
              type="text"
              className="input text-sm w-full mb-1"
              placeholder="Pesquisar por nome, email ou telefone..."
              value={clientSearch}
              onChange={e => onClientSearch(e.target.value)}
            />
            <select
              className="input text-sm w-full bg-white"
              value={form.cliente_id ?? ''}
              onChange={e => upd('cliente_id', e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">— Desconto geral (todos os clientes) —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ''}</option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">
              Deixa vazio para um desconto geral aplicável a qualquer cliente.
            </p>
          </div>

          <div>
            <label className="label">Nome <span className="text-red-500">*</span></label>
            <input
              type="text" className="input w-full"
              value={form.nome} onChange={e => upd('nome', e.target.value)}
              placeholder="Ex.: Desconto de aniversário"
            />
          </div>

          <div>
            <label className="label">Descrição</label>
            <textarea
              rows={2} className="input w-full resize-none"
              value={form.descricao} onChange={e => upd('descricao', e.target.value)}
              placeholder="Opcional — aparece no perfil do cliente"
            />
          </div>

          <div>
            <label className="label">Tipo <span className="text-red-500">*</span></label>
            <select
              className="input text-sm w-full bg-white"
              value={form.tipo}
              onChange={e => handleTipoChange(e.target.value)}
            >
              {TIPO_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Desconto em percentagem (%)</label>
              <input
                type="number" min={0} max={100} step={1} className="input w-full"
                value={form.valor_percentagem ?? ''}
                onChange={e => upd('valor_percentagem', e.target.value ? Number(e.target.value) : null)}
                placeholder="Ex.: 10"
              />
            </div>
            <div>
              <label className="label">Valor fixo (€)</label>
              <input
                type="number" min={0} step={0.5} className="input w-full"
                value={form.valor_fixo_centimos != null ? (form.valor_fixo_centimos / 100) : ''}
                onChange={e => upd('valor_fixo_centimos', e.target.value ? Math.round(Number(e.target.value) * 100) : null)}
                placeholder="Ex.: 5.00"
              />
            </div>
          </div>
          <p className="text-xs text-gray-400">
            Preenche apenas um dos dois campos (percentagem tem prioridade no checkout).
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Válido de</label>
              <input type="date" className="input w-full"
                value={form.valido_de}
                onChange={e => upd('valido_de', e.target.value)} />
            </div>
            <div>
              <label className="label">Válido até</label>
              <input type="date" className="input w-full"
                value={form.valido_ate}
                onChange={e => upd('valido_ate', e.target.value)} />
            </div>
          </div>

          {/* Campos de quantidade (visíveis para tipos 'quantidade' e 'mensal') */}
          {showQuantidade && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">Regras de quantidade</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Mín. reservas necessárias</label>
                  <input
                    type="number" min={0} step={1} className="input w-full"
                    value={form.min_reservas ?? ''}
                    onChange={e => upd('min_reservas', e.target.value ? Number(e.target.value) : null)}
                    placeholder="Ex.: 2"
                  />
                </div>
                <div>
                  <label className="label">Período</label>
                  <select
                    className="input text-sm w-full bg-white"
                    value={form.min_reservas_periodo ?? ''}
                    onChange={e => upd('min_reservas_periodo', e.target.value || null)}
                  >
                    <option value="">— Nenhum —</option>
                    {PERIODO_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Grupo (programa escalonado)</label>
                <input
                  type="text"
                  className="input text-sm w-full"
                  placeholder="Ex.: frequencia-mensal"
                  value={form.grupo ?? ''}
                  onChange={e => upd('grupo', e.target.value || null)}
                />
                <p className="text-[10px] text-indigo-500 mt-0.5">
                  Descontos com o mesmo grupo competem entre si — aplica-se apenas o melhor.
                </p>
              </div>
            </div>
          )}

          {/* Grupo também disponível fora de "quantidade" (ex.: campanhas escalonadas) */}
          {!showQuantidade && (
            <div>
              <label className="label">Grupo (programa)</label>
              <input
                type="text"
                className="input text-sm w-full"
                placeholder="Opcional — ex.: campanha-verão-2026"
                value={form.grupo ?? ''}
                onChange={e => upd('grupo', e.target.value || null)}
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Descontos com o mesmo grupo competem entre si — aplica-se apenas o melhor.
              </p>
            </div>
          )}

          <div>
            <label className="label">Máximo de usos</label>
            <input
              type="number" min={1} step={1} className="input w-full"
              value={form.max_usos ?? ''}
              onChange={e => upd('max_usos', e.target.value ? Number(e.target.value) : null)}
              placeholder="Deixa vazio para ilimitado (vitalício)"
            />
            <p className="text-xs text-gray-400 mt-1">
              1 = ocasional (one-shot) · vazio = ilimitado
            </p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox" className="rounded"
              checked={form.ativo}
              onChange={e => upd('ativo', e.target.checked)}
            />
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

// ─── Linha da tabela ─────────────────────────────────────────────────────────────────────────────────────
function DiscountRow({
  d,
  onEdit,
  onDelete,
  onToggleAtivo,
}: {
  d: Discount & { cliente_nome?: string }
  onEdit: () => void
  onDelete: () => void
  onToggleAtivo: () => void
}) {
  const tipoClass = TIPO_BADGE[d.type] ?? TIPO_BADGE.outro
  const isGeral   = d.client_id == null

  return (
    <tr className="hover:bg-gray-50 border-b border-gray-50 last:border-0">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {isGeral
            ? <Users size={14} className="text-gray-400 flex-shrink-0" />
            : <User  size={14} className="text-brand-400 flex-shrink-0" />
          }
          <div>
            <p className="text-sm font-medium text-gray-900">{d.name}</p>
            {d.description && <p className="text-xs text-gray-400 truncate max-w-[220px]">{d.description}</p>}
            {d.group && (
              <p className="text-[10px] text-indigo-400 font-mono mt-0.5">⧕ {d.group}</p>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {isGeral
          ? <span className="italic text-gray-400">Geral</span>
          : <span>{(d as any).cliente_nome ?? `#${d.client_id}`}</span>
        }
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${tipoClass}`}>
          {d.type}
        </span>
        {d.min_reservations != null && d.min_reservations_period && (
          <p className="text-[10px] text-gray-400 mt-0.5">
            ≥{d.min_reservations} / {d.min_reservations_period}
          </p>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-semibold text-gray-800">{fmtValor(d)}</td>
      <td className="px-4 py-3 text-xs text-gray-500">
        {d.max_uses == null ? '\u221e' : `${d.used_count ?? 0} / ${d.max_uses}`}
      </td>
      <td className="px-4 py-3 text-xs text-gray-400">
        {fmtData(d.valid_from)} {d.valid_from && d.valid_to ? '\u2192' : ''} {fmtData(d.valid_to)}
        {!d.valid_from && !d.valid_to && <span className="italic">Sem limite</span>}
      </td>
      <td className="px-4 py-3">
        <button
          onClick={onToggleAtivo}
          title={d.active ? 'Desativar' : 'Ativar'}
          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
            d.active
              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
          }`}
        >
          {d.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button onClick={onEdit}
            className="p-1.5 rounded-lg text-gray-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <Edit2 size={13} />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

// ─── Página principal ────────────────────────────────────────────────────────────────────────────────────
export default function DiscountsPage() {
  const adminUser = useAdminUser()
  const isSA      = isSuperAdmin(adminUser)
  const qc        = useQueryClient()

  const [modalOpen, setModalOpen]     = useState(false)
  const [editing, setEditing]         = useState<(DiscountForm & { id?: number }) | null>(null)
  const [filterTipo, setFilterTipo]   = useState('')
  const [filterAtivo, setFilterAtivo] = useState<'all' | '1' | '0'>('all')
  const [filterCliente, setFilterCliente] = useState('')
  const [saving, setSaving]           = useState(false)

  // Pesquisa de clientes (usada no modal e no filtro)
  const [clientSearch, setClientSearch] = useState('')

  // ── Dados ────────────────────────────────────────────────────────────────────────────────────
  const { data: discountsRes, isLoading } = useQuery({
    queryKey: ['admin-discounts', filterTipo, filterAtivo, filterCliente],
    queryFn: () => {
      const params = new URLSearchParams()
      if (filterTipo)            params.set('tipo',       filterTipo)
      if (filterAtivo !== 'all') params.set('ativo',      filterAtivo)
      if (filterCliente)         params.set('cliente_id', filterCliente)
      return adminApi.get<any[]>(`${API}?${params.toString()}`)
    },
    enabled: isSA,
  })

  // Clientes com pesquisa dinâmica (máx. 20 resultados)
  const { data: clientsRes } = useQuery({
    queryKey: ['clients-discount-search', clientSearch],
    queryFn:  () => clientsApi.list({ search: clientSearch, page: 1, perPage: 20 }),
    enabled: isSA,
  })

  const discounts: (Discount & { cliente_nome?: string })[] =
    (discountsRes?.data ?? []).map((d: any) => ({
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
      min_reservations:         d.min_reservas ?? null,
      min_reservations_period:  d.min_reservas_periodo ?? null,
      group:                    d.grupo ?? null,
      rule_type:                d.regra_tipo ?? null,
      rule_detail:              d.regra_detalhe ?? null,
      max_uses:                 d.max_usos,
      used_count:               d.usos_feitos ?? 0,
      last_used_at:             d.usado_ultima_vez_em,
      last_used_reservation_id: d.usado_ultima_reserva_id,
      usage_comment:            d.comentario_uso,
      active:                   !!d.ativo,
      created_by_admin_id:      d.criado_por_admin_id,
      created_at:               d.criado_em,
      updated_at:               d.atualizado_em,
      cliente_nome:             d.cliente_nome,
    }))

  const clients: Client[] = clientsRes?.data?.items ?? []

  // ── Mutations ───────────────────────────────────────────────────────────────────────────────────
  const handleSave = async (form: DiscountForm & { id?: number }) => {
    setSaving(true)
    try {
      const payload = {
        cliente_id:           form.cliente_id,
        nome:                 form.nome,
        descricao:            form.descricao || null,
        tipo:                 form.tipo,
        origem:               'manual',
        valor_percentagem:    form.valor_percentagem,
        valor_fixo_centimos:  form.valor_fixo_centimos,
        valido_de:            form.valido_de  || null,
        valido_ate:           form.valido_ate || null,
        min_reservas:         form.min_reservas,
        min_reservas_periodo: form.min_reservas_periodo,
        grupo:                form.grupo,
        regra_tipo:           form.regra_tipo,
        regra_detalhe:        form.regra_detalhe,
        max_usos:             form.max_usos,
        ativo:                form.ativo,
      }
      if (form.id) {
        await adminApi.put(`${API}/${form.id}`, payload)
      } else {
        await adminApi.post(API, payload)
      }
      qc.invalidateQueries({ queryKey: ['admin-discounts'] })
      setModalOpen(false)
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Tens a certeza que queres eliminar este desconto?')) return
    await adminApi.delete(`${API}/${id}`)
    qc.invalidateQueries({ queryKey: ['admin-discounts'] })
  }

  const handleToggleAtivo = async (d: Discount) => {
    await adminApi.put(`${API}/${d.id}`, { ativo: !d.active })
    qc.invalidateQueries({ queryKey: ['admin-discounts'] })
  }

  const openNew = () => {
    setClientSearch('')
    setEditing({ ...emptyForm() })
    setModalOpen(true)
  }

  const openEdit = (d: Discount & { cliente_nome?: string }) => {
    setClientSearch(d.cliente_nome ?? '')
    setEditing({
      id:                   d.id,
      cliente_id:           d.client_id,
      nome:                 d.name,
      descricao:            d.description ?? '',
      tipo:                 d.type,
      valor_percentagem:    d.value_percent ?? null,
      valor_fixo_centimos:  d.value_fixed   ?? null,
      valido_de:            d.valid_from    ? d.valid_from.slice(0, 10) : '',
      valido_ate:           d.valid_to      ? d.valid_to.slice(0, 10)   : '',
      min_reservas:         d.min_reservations ?? null,
      min_reservas_periodo: d.min_reservations_period ?? null,
      grupo:                d.group ?? null,
      regra_tipo:           d.rule_type ?? null,
      regra_detalhe:        d.rule_detail ?? null,
      max_usos:             d.max_uses ?? null,
      ativo:                d.active,
    })
    setModalOpen(true)
  }

  // ── Guard: só superAdmin ───────────────────────────────────────────────────────────────────────
  if (!isSA) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3 text-gray-400">
        <Tag size={40} />
        <p className="text-sm">Acesso restrito a super-administradores.</p>
      </div>
    )
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  const geralCount     = discounts.filter(d => d.client_id == null).length
  const exclusivoCount = discounts.filter(d => d.client_id != null).length
  const ativoCount     = discounts.filter(d => d.active).length

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Tag size={20} className="text-brand-500" /> Descontos
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {discounts.length} desconto{discounts.length !== 1 ? 's' : ''} &middot;{' '}
            {geralCount} geral{geralCount !== 1 ? 'is' : ''} &middot;{' '}
            {exclusivoCount} exclusivo{exclusivoCount !== 1 ? 's' : ''} &middot;{' '}
            {ativoCount} ativo{ativoCount !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={openNew} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo desconto
        </button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label text-xs">Tipo</label>
            <select className="input text-sm bg-white" value={filterTipo}
              onChange={e => setFilterTipo(e.target.value)}>
              <option value="">Todos</option>
              {TIPO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Estado</label>
            <select className="input text-sm bg-white" value={filterAtivo}
              onChange={e => setFilterAtivo(e.target.value as 'all' | '1' | '0')}>
              <option value="all">Todos</option>
              <option value="1">Ativos</option>
              <option value="0">Inativos</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Cliente (filtro)</label>
            <select className="input text-sm bg-white" value={filterCliente}
              onChange={e => setFilterCliente(e.target.value)}>
              <option value="">Todos (incl. gerais)</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {(filterTipo || filterAtivo !== 'all' || filterCliente) && (
            <button
              onClick={() => { setFilterTipo(''); setFilterAtivo('all'); setFilterCliente('') }}
              className="text-xs text-gray-500 hover:text-gray-700 underline pb-1"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Tabela */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Desconto', 'Cliente', 'Tipo', 'Valor', 'Usos', 'Validade', 'Estado', ''].map(h => (
                  <th key={h}
                    className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {discounts.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-12 text-sm">
                    Nenhum desconto encontrado.
                  </td>
                </tr>
              )}
              {discounts.map(d => (
                <DiscountRow
                  key={d.id}
                  d={d}
                  onEdit={() => openEdit(d)}
                  onDelete={() => handleDelete(d.id)}
                  onToggleAtivo={() => handleToggleAtivo(d)}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-gray-400">
        <span className="flex items-center gap-1"><Users size={12} /> Desconto geral</span>
        <span className="flex items-center gap-1"><User  size={12} className="text-brand-400" /> Desconto exclusivo</span>
      </div>

      {/* Modal */}
      {modalOpen && editing && (
        <DiscountModal
          initial={editing}
          clients={clients}
          clientSearch={clientSearch}
          onClientSearch={setClientSearch}
          onClose={() => { setModalOpen(false); setEditing(null) }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  )
}
