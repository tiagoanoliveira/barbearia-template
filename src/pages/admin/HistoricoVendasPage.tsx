import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAdminUser, isSuperAdmin } from '@/hooks/useAdminUser'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { ChevronDown, ChevronUp, Pencil, X, Save, Gift, Plus, Minus, Trash2 } from 'lucide-react'
import type { Client } from '@/types'
import { ClientSearchInput } from '@/components/admin/ClientSearchInput'

const MEIO_LABEL: Record<string, string> = {
  multibanco:    '💳 Multibanco',
  dinheiro:      '💵 Dinheiro',
  mbway:         '📱 MB Way',
  transferencia: '🏦 Transferência',
  outro:         '❓ Outro',
  oferta:        '🎁 Oferta',
}

const MEIO_OPTIONS = [
  { value: 'dinheiro',      label: '💵 Dinheiro' },
  { value: 'multibanco',    label: '💳 Multibanco' },
  { value: 'mbway',         label: '📱 MB Way' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'outro',         label: '❓ Outro' },
  { value: 'oferta',        label: '🎁 Oferta' },
]

const MEIOS_COM_NOTA = ['mbway', 'transferencia', 'outro']

function fmt(centimos: number | null | undefined) {
  return centimos != null ? (centimos / 100).toFixed(2) + ' €' : '—'
}

interface Produto  { id: number; nome: string; preco_centimos: number; categoria_nome: string; ativo: number }
interface AdminUser { id: number; nome: string }

export default function HistoricoVendasPage() {
  const adminUser = useAdminUser()
  if (!isSuperAdmin(adminUser)) return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
  return <HistoricoVendasContent />
}

// ─── Modal de edição completa de venda ─────────────────────────────────────────────────
function EditVendaModal({ venda, onClose, onSaved }: { venda: any; onClose: () => void; onSaved: () => void }) {
  const isSA = isSuperAdmin(useAdminUser())

  // Produtos no carrinho de edição — pre-populado com os itens atuais
  const [carrinho, setCarrinho] = useState<Array<{
    produto_id: number
    produto_nome: string
    preco_unitario_centimos: number
    quantidade: number
    oferta: boolean
  }>>(venda.itens?.map((i: any) => ({
    produto_id:              i.produto_id,
    produto_nome:            i.produto_nome,
    preco_unitario_centimos: i.preco_unitario_centimos,
    quantidade:              i.quantidade,
    oferta:                  !!i.oferta,
  })) ?? [])

  const [meioPagamento, setMeioPagamento] = useState<string>(venda.meio_pagamento ?? 'dinheiro')
  const [notas,         setNotas]         = useState<string>(venda.notas ?? '')
  const [gorjeta,       setGorjeta]       = useState<string>(venda.gorjeta != null ? (venda.gorjeta / 100).toFixed(2) : '')
  const [meioGorjeta,   setMeioGorjeta]   = useState<string>(venda.meio_gorjeta ?? 'dinheiro')
  const [ofertaTipo,    setOfertaTipo]    = useState<string>(venda.oferta_tipo ?? '')

  // Cliente — usa o tipo Client correto (campos em inglês: name, phone, email, photo_url)
  // A API devolve cliente_nome e cliente_id na venda; construímos um Client parcial para pré-preencher
  const [clienteSel, setClienteSel] = useState<Client | null>(
    venda.cliente_id
      ? {
          id:         venda.cliente_id,
          name:       venda.cliente_nome ?? '',
          email:      venda.cliente_email ?? undefined,
          phone:      venda.cliente_telefone ?? undefined,
          photo_url:  venda.cliente_foto ?? undefined,
          created_at: '',
        }
      : null
  )

  // Vendedor
  const [adminUserSel, setAdminUserSel] = useState<number | ''>(venda.admin_user_id ?? '')

  const [erro, setErro] = useState('')

  const isOferta = meioPagamento === 'oferta'

  // Produtos disponíveis para adicionar
  const { data: produtosData } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn:  () => adminApi.get<Produto[]>('/api/admin/produtos?ativo=1'),
  })
  const { data: adminUsersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn:  () => adminApi.get<AdminUser[]>('/api/admin/admin-users'),
    enabled:  isSA,
  })

  const produtos   = (produtosData?.data ?? []) as Produto[]
  const adminUsers = (adminUsersData?.data ?? []) as AdminUser[]

  // Carrinho helpers
  const totalBruto = carrinho.reduce((s, i) => s + i.preco_unitario_centimos * i.quantidade, 0)
  const totalCobrado = carrinho.reduce((s, i) => s + (i.oferta ? 0 : i.preco_unitario_centimos * i.quantidade), 0)

  function addProduto(p: Produto) {
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i.produto_id === p.id)
      if (idx >= 0) { const n = [...prev]; n[idx] = { ...n[idx], quantidade: n[idx].quantidade + 1 }; return n }
      return [...prev, { produto_id: p.id, produto_nome: p.nome, preco_unitario_centimos: p.preco_centimos, quantidade: 1, oferta: false }]
    })
  }
  function setQty(pid: number, qty: number) {
    if (qty <= 0) setCarrinho(prev => prev.filter(i => i.produto_id !== pid))
    else setCarrinho(prev => prev.map(i => i.produto_id === pid ? { ...i, quantidade: qty } : i))
  }
  function toggleOferta(pid: number) {
    setCarrinho(prev => prev.map(i => i.produto_id === pid ? { ...i, oferta: !i.oferta } : i))
  }

  const mutation = useMutation({
    mutationFn: (payload: object) => adminApi.patch(`/api/admin/produto-vendas/${venda.id}`, payload),
    onSuccess: () => { onSaved(); onClose() },
    onError: (e: any) => setErro(e?.message ?? 'Erro ao guardar'),
  })

  function guardar() {
    setErro('')
    if (!isOferta && MEIOS_COM_NOTA.includes(meioPagamento) && !notas.trim()) {
      setErro('Indica para quem ou o motivo do meio de pagamento nas notas.')
      return
    }
    if (isOferta && !ofertaTipo) { setErro('Seleciona o tipo de oferta.'); return }
    if (carrinho.length === 0) { setErro('Adiciona pelo menos um produto.'); return }
    const gorjetaCent = gorjeta.trim() !== '' ? Math.round(parseFloat(gorjeta) * 100) : null
    mutation.mutate({
      meio_pagamento: meioPagamento,
      notas:          notas.trim() || null,
      gorjeta:        gorjetaCent,
      meio_gorjeta:   gorjetaCent ? meioGorjeta : null,
      oferta_tipo:    isOferta ? ofertaTipo : null,
      oferta_valor:   isOferta ? totalBruto : null,
      total_centimos: isOferta ? 0 : totalCobrado,
      cliente_id:     clienteSel?.id ?? null,
      admin_user_id:  adminUserSel !== '' ? adminUserSel : undefined,
      itens: carrinho.map(i => ({
        produto_id:              i.produto_id,
        quantidade:              i.quantidade,
        preco_unitario_centimos: i.preco_unitario_centimos,
        oferta:                  i.oferta,
      })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto p-6 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={18} /></button>
        <h2 className="text-base font-bold text-gray-900 mb-4">Editar Venda #{venda.id}</h2>

        <div className="space-y-4">

          {/* ─ Produtos no carrinho ─ */}
          <div>
            <p className="label text-xs mb-2">Produtos</p>
            {carrinho.length === 0 && <p className="text-xs text-gray-400 mb-2">Sem produtos. Adiciona abaixo.</p>}
            <div className="space-y-2 mb-3">
              {carrinho.map(item => (
                <div key={item.produto_id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium truncate ${item.oferta ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.produto_nome}</p>
                    <p className="text-xs text-gray-400">{(item.preco_unitario_centimos / 100).toFixed(2)} €/un</p>
                  </div>
                  <button onClick={() => toggleOferta(item.produto_id)}
                    title={item.oferta ? 'Remover oferta' : 'Marcar como oferta'}
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${item.oferta ? 'bg-amber-100 text-amber-600' : 'bg-gray-200 text-gray-400 hover:bg-amber-50 hover:text-amber-500'}`}>
                    <Gift size={10} />
                  </button>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setQty(item.produto_id, item.quantidade - 1)} className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Minus size={10} /></button>
                    <span className="text-xs font-semibold w-5 text-center">{item.quantidade}</span>
                    <button onClick={() => setQty(item.produto_id, item.quantidade + 1)} className="w-6 h-6 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center"><Plus size={10} /></button>
                  </div>
                  <button onClick={() => setCarrinho(prev => prev.filter(i => i.produto_id !== item.produto_id))}
                    className="w-6 h-6 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 flex items-center justify-center"><Trash2 size={10} /></button>
                </div>
              ))}
            </div>
            {/* Adicionar produto */}
            {produtos.length > 0 && (
              <details className="border border-dashed border-gray-200 rounded-xl">
                <summary className="px-3 py-2 text-xs text-gray-500 cursor-pointer hover:text-brand-600 select-none">
                  <Plus size={11} className="inline mr-1" />Adicionar produto
                </summary>
                <div className="p-2 grid grid-cols-2 gap-1 max-h-36 overflow-y-auto">
                  {produtos.map(p => (
                    <button key={p.id} onClick={() => addProduto(p)}
                      className="text-left px-2 py-1.5 rounded-lg hover:bg-brand-50 text-xs">
                      <span className="font-medium text-gray-800 block truncate">{p.nome}</span>
                      <span className="text-brand-600">{(p.preco_centimos / 100).toFixed(2)} €</span>
                    </button>
                  ))}
                </div>
              </details>
            )}
            <div className="flex justify-between text-sm font-semibold mt-2 px-1">
              <span className="text-gray-500">Total a cobrar</span>
              <span className="text-gray-900">{isOferta ? '0.00 €' : (totalCobrado / 100).toFixed(2) + ' €'}</span>
            </div>
          </div>

          {/* ─ Meio de pagamento ─ */}
          <div>
            <label className="label text-xs">Meio de Pagamento</label>
            <select className="input text-sm w-full" value={meioPagamento}
              onChange={e => { setMeioPagamento(e.target.value); setNotas(''); setOfertaTipo('') }}>
              {MEIO_OPTIONS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>

          {isOferta && (
            <div>
              <label className="label text-xs">Tipo de Oferta <span className="text-red-500">*</span></label>
              <select className="input text-sm w-full" value={ofertaTipo} onChange={e => setOfertaTipo(e.target.value)}>
                <option value="">— Selecionar —</option>
                <option value="fidelidade">Fidelidade</option>
                <option value="desconto">Desconto</option>
                <option value="cortesia">Cortesia</option>
                <option value="outro">Outro</option>
              </select>
            </div>
          )}

          {MEIOS_COM_NOTA.includes(meioPagamento) && (
            <div>
              <label className="label text-xs">Para quem / Motivo <span className="text-red-500">*</span></label>
              <textarea className="input text-sm w-full resize-none" rows={2}
                value={notas} onChange={e => setNotas(e.target.value)}
                placeholder="Ex.: MB Way para João Silva (+351 912...)" />
            </div>
          )}

          {/* ─ Gorjeta ─ */}
          {!isOferta && (
            <div className="border border-gray-100 rounded-xl p-3 bg-gray-50 space-y-2">
              <p className="text-xs font-semibold text-gray-500">Gorjeta</p>
              <div className="flex gap-2">
                <input type="number" min="0" step="0.5" placeholder="0.00"
                  className="input text-sm flex-1" value={gorjeta}
                  onChange={e => setGorjeta(e.target.value)} />
                {gorjeta.trim() !== '' && parseFloat(gorjeta) > 0 && (
                  <select className="input text-sm w-36" value={meioGorjeta} onChange={e => setMeioGorjeta(e.target.value)}>
                    {MEIO_OPTIONS.filter(m => m.value !== 'oferta').map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          {/* ─ Notas livres ─ */}
          {!MEIOS_COM_NOTA.includes(meioPagamento) && (
            <div>
              <label className="label text-xs">Notas</label>
              <textarea className="input text-sm w-full resize-none" rows={2}
                value={notas} onChange={e => setNotas(e.target.value)} placeholder="Observações..." />
            </div>
          )}

          {/* ─ Cliente — componente partilhado com reservas ─ */}
          <div>
            <label className="label text-xs">Cliente</label>
            <ClientSearchInput
              selected={clienteSel}
              onSelect={c => setClienteSel(c)}
              onClear={() => setClienteSel(null)}
            />
          </div>

          {/* ─ Vendedor ─ */}
          {isSA && (
            <div>
              <label className="label text-xs">Vendedor</label>
              <select className="input text-sm w-full" value={adminUserSel}
                onChange={e => setAdminUserSel(e.target.value !== '' ? Number(e.target.value) : '')}>
                <option value="">— Sem atribuição —</option>
                {adminUsers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
          )}

          {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
            <button onClick={guardar} disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
              <Save size={14} /> {mutation.isPending ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Conteúdo principal ──────────────────────────────────────────────────────
function HistoricoVendasContent() {
  const now      = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const today    = now.toISOString().slice(0, 10)

  const [dateFrom,     setDateFrom]     = useState(firstDay)
  const [dateTo,       setDateTo]       = useState(today)
  const [adminUserId,  setAdminUserId]  = useState('')   // filtro local
  const [expandedId,   setExpandedId]   = useState<number | null>(null)
  const [editingVenda, setEditingVenda] = useState<any | null>(null)

  const qc = useQueryClient()

  // Carrega SEMPRE sem filtro de vendedor — filtragem feita no frontend
  const { data, isLoading } = useQuery({
    queryKey: ['produto-vendas', dateFrom, dateTo],
    queryFn: () => adminApi.get<any[]>(`/api/admin/produto-vendas?data_inicio=${dateFrom}&data_fim=${dateTo}`),
  })

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn:  () => adminApi.get<any[]>('/api/admin/admin-users'),
  })

  const todasVendas = (data?.data      ?? []) as any[]
  const adminUsers  = (adminUsersData?.data ?? []) as any[]

  // Filtro de vendedor aplicado no frontend — garante que funciona independentemente da API
  const vendas = useMemo(() =>
    adminUserId
      ? todasVendas.filter(v => String(v.admin_user_id) === adminUserId)
      : todasVendas
  , [todasVendas, adminUserId])

  const resumo = useMemo(() => {
    let totalVendido = 0, totalGorjetas = 0, totalOfertas = 0
    const porMeio:     Record<string, number> = {}
    const porVendedor: Record<string, { nome: string; total: number; gorjetas: number; ofertas: number }> = {}

    for (const v of vendas) {
      const total = v.total_centimos ?? 0
      const gorj  = v.gorjeta ?? 0
      const ofv   = v.oferta_valor ?? 0
      totalVendido  += total
      totalGorjetas += gorj
      totalOfertas  += ofv
      const meio = v.meio_pagamento ?? 'outro'
      porMeio[meio] = (porMeio[meio] ?? 0) + total
      const uid = String(v.admin_user_id ?? 'desconhecido')
      if (!porVendedor[uid]) porVendedor[uid] = { nome: v.admin_user_nome ?? '—', total: 0, gorjetas: 0, ofertas: 0 }
      porVendedor[uid].total    += total
      porVendedor[uid].gorjetas += gorj
      porVendedor[uid].ofertas  += ofv
    }
    return {
      totalVendido, totalGorjetas, totalOfertas,
      media: vendas.length > 0 ? Math.round(totalVendido / vendas.length) : 0,
      porMeio: Object.entries(porMeio).sort(([,a],[,b]) => b - a),
      porVendedor: Object.values(porVendedor).sort((a, b) => b.total - a.total),
    }
  }, [vendas])

  const shortcuts = [
    { label: 'Este mês',    from: firstDay, to: today },
    { label: 'Mês passado', from: (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toISOString().slice(0,10) })(), to: (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0,10) })() },
    { label: 'Este ano',    from: `${now.getFullYear()}-01-01`, to: today },
  ]

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Histórico de Vendas</h1>

      <Card>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="label text-xs">De</label>
            <input type="date" className="input text-sm" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Até</label>
            <input type="date" className="input text-sm" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Vendedor</label>
            <select className="input text-sm" value={adminUserId} onChange={e => setAdminUserId(e.target.value)}>
              <option value="">Todos</option>
              {adminUsers.map((u: any) => <option key={u.id} value={String(u.id)}>{u.nome}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            {shortcuts.map(p => (
              <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total vendido',   value: fmt(resumo.totalVendido) },
          { label: 'Nº de vendas',    value: String(vendas.length) },
          { label: 'Média por venda', value: fmt(resumo.media) },
          { label: 'Gorjetas',        value: fmt(resumo.totalGorjetas) },
        ].map(k => (
          <Card key={k.label}>
            <p className="text-xs text-gray-500 mb-1">{k.label}</p>
            <p className="text-xl font-bold text-gray-900">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <h3 className="font-semibold text-sm mb-3">Por meio de pagamento</h3>
          {resumo.porMeio.length === 0
            ? <p className="text-xs text-gray-400">Sem dados</p>
            : <div className="space-y-2">
                {resumo.porMeio.map(([meio, total]) => (
                  <div key={meio} className="flex justify-between text-sm">
                    <span>{MEIO_LABEL[meio] ?? meio}</span>
                    <span className="font-medium">{fmt(total)}</span>
                  </div>
                ))}
              </div>
          }
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-3">Gorjetas &amp; Ofertas</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>🎁 Total gorjetas</span>
              <span className="font-medium">{fmt(resumo.totalGorjetas)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span><Gift size={13} className="inline mr-1 text-amber-500" />Total ofertas</span>
              <span className="font-medium text-amber-600">{fmt(resumo.totalOfertas)}</span>
            </div>
          </div>
        </Card>
        <Card>
          <h3 className="font-semibold text-sm mb-3">Por vendedor</h3>
          {resumo.porVendedor.length === 0
            ? <p className="text-xs text-gray-400">Sem dados</p>
            : <div className="space-y-3">
                {resumo.porVendedor.map(v => (
                  <div key={v.nome}>
                    <div className="flex justify-between text-sm font-semibold">
                      <span>{v.nome}</span><span>{fmt(v.total)}</span>
                    </div>
                    <div className="pl-1 flex gap-3 text-xs text-gray-500 mt-0.5">
                      {v.gorjetas > 0 && <span>🎁 {fmt(v.gorjetas)}</span>}
                      {v.ofertas  > 0 && <span className="text-amber-600">Ofertas: {fmt(v.ofertas)}</span>}
                    </div>
                  </div>
                ))}
              </div>
          }
        </Card>
      </div>

      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm">Detalhe das vendas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Data','Vendedor','Cliente','Meio Pag.','Total','Gorjeta','Notas',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendas.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8 text-xs">Sem vendas no período selecionado</td></tr>
              )}
              {vendas.map((v: any) => (
                <>
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(parseISO(v.criado_em), "d MMM yyyy HH:mm", { locale: pt })}
                    </td>
                    <td className="px-4 py-3 text-xs">{v.admin_user_nome}</td>
                    <td className="px-4 py-3 text-xs">{v.cliente_nome ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        v.meio_pagamento === 'oferta' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {MEIO_LABEL[v.meio_pagamento] ?? v.meio_pagamento}
                      </span>
                      {v.oferta_tipo && <span className="ml-1 text-[11px] text-amber-500">({v.oferta_tipo})</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-xs">{fmt(v.total_centimos)}</td>
                    <td className="px-4 py-3 text-xs">
                      {v.gorjeta
                        ? `${fmt(v.gorjeta)}${MEIO_LABEL[v.meio_gorjeta] ? ' · ' + MEIO_LABEL[v.meio_gorjeta] : ''}`
                        : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate" title={v.notas ?? ''}>{v.notas ?? '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {v.itens?.length > 0 && (
                          <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1">
                            {expandedId === v.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}{v.itens.length}
                          </button>
                        )}
                        <button onClick={() => setEditingVenda(v)}
                          className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 flex items-center gap-1 font-medium">
                          <Pencil size={11} /> Editar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-itens`} className="bg-gray-50">
                      <td colSpan={8} className="px-8 py-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400">
                              <th className="text-left font-medium pb-1">Produto</th>
                              <th className="text-left font-medium pb-1">Categoria</th>
                              <th className="text-right font-medium pb-1">Qtd</th>
                              <th className="text-right font-medium pb-1">P. Unit.</th>
                              <th className="text-right font-medium pb-1">Subtotal</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {v.itens.map((item: any, idx: number) => (
                              <tr key={idx}>
                                <td className="py-1 pr-4">{item.produto_nome}</td>
                                <td className="py-1 pr-4 text-gray-400">{item.categoria_nome}</td>
                                <td className="py-1 text-right">{item.quantidade}</td>
                                <td className="py-1 text-right">{fmt(item.preco_unitario_centimos)}</td>
                                <td className="py-1 text-right font-medium">{fmt(item.preco_unitario_centimos * item.quantidade)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editingVenda && (
        <EditVendaModal
          venda={editingVenda}
          onClose={() => setEditingVenda(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['produto-vendas'] }); setEditingVenda(null) }}
        />
      )}
    </div>
  )
}
