import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ShoppingCart, Plus, Minus, Trash2, X, ShoppingBag, Gift } from 'lucide-react'
import { useAdminUser, isSuperAdmin } from '@/hooks/useAdminUser'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { ClientSearchInput } from '@/components/admin/ClientSearchInput'
import type { Client } from '@/types'

const MEIOS_COM_NOTA_OBRIGATORIA = ['mbway', 'transferencia', 'outro']

const MEIO_LABELS = [
  { value: 'dinheiro',      label: '💵 Dinheiro' },
  { value: 'multibanco',    label: '💳 Multibanco' },
  { value: 'mbway',         label: '📱 MB Way' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'outro',         label: '❓ Outro' },
]

interface Produto {
  id: number
  nome: string
  preco_centimos: number
  categoria_id: number
  categoria_nome: string
  ativo: number
}

interface CarrinhoItem {
  produto: Produto
  quantidade: number
  oferta: boolean
}

interface AdminUser {
  id: number
  nome: string
}

export default function VendasProdutosPage() {
  const adminUser = useAdminUser()
  if (adminUser?.role === 'barbeiro') return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
  return <VendasProdutosContent />
}

function VendasProdutosContent() {
  const adminUser = useAdminUser()
  const qc = useQueryClient()

  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([])
  const [modalAberto, setModalAberto] = useState(false)

  const [meioPagamento,   setMeioPagamento]   = useState('dinheiro')
  const [notaPagamento,   setNotaPagamento]   = useState('')
  const [gorjetaCentimos, setGorjetaCentimos] = useState('')
  const [meioGorjeta,     setMeioGorjeta]     = useState('dinheiro')
  const [ofertaToda,      setOfertaToda]      = useState(false)
  const [ofertaTipo,      setOfertaTipo]      = useState('')

  const [clienteSel, setClienteSel] = useState<Client | null>(null)
  const [adminUserSel, setAdminUserSel] = useState<AdminUser | null>(null)

  const [erro,    setErro]    = useState('')
  const [sucesso, setSucesso] = useState(false)
  // Snapshot do total no momento em que a venda é confirmada
  const [totalSucesso, setTotalSucesso] = useState(0)

  const isSA = isSuperAdmin(adminUser)

  const { data: produtosData, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn:  () => adminApi.get<Produto[]>('/api/admin/produtos?ativo=1'),
  })

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn:  () => adminApi.get<AdminUser[]>('/api/admin/admin-users'),
    enabled:  isSA,
  })

  const porCategoria = useMemo(() => {
    const produtos = (produtosData?.data ?? []) as Produto[]
    const mapa: Record<string, Produto[]> = {}
    for (const p of produtos) {
      if (!mapa[p.categoria_nome]) mapa[p.categoria_nome] = []
      mapa[p.categoria_nome].push(p)
    }
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [produtosData])

  const totalCentimos = carrinho.reduce((acc, i) =>
    acc + (i.oferta ? 0 : i.produto.preco_centimos * i.quantidade), 0)
  const totalBrutoCentimos = carrinho.reduce((acc, i) =>
    acc + i.produto.preco_centimos * i.quantidade, 0)

  function addProduto(produto: Produto) {
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i.produto.id === produto.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 }
        return next
      }
      return [...prev, { produto, quantidade: 1, oferta: false }]
    })
  }

  function setQty(produtoId: number, qty: number) {
    if (qty <= 0) setCarrinho(prev => prev.filter(i => i.produto.id !== produtoId))
    else setCarrinho(prev => prev.map(i => i.produto.id === produtoId ? { ...i, quantidade: qty } : i))
  }

  function toggleOfertaItem(produtoId: number) {
    setCarrinho(prev => prev.map(i => i.produto.id === produtoId ? { ...i, oferta: !i.oferta } : i))
  }

  const mutation = useMutation({
    mutationFn: (payload: object) => adminApi.post('/api/admin/produto-vendas', payload),
    onSuccess: () => {
      setSucesso(true)
      setCarrinho([])
      qc.invalidateQueries({ queryKey: ['produto-vendas'] })
      setTimeout(() => { setSucesso(false); fecharModal() }, 2200)
    },
    onError: (e: any) => setErro(e?.message ?? 'Erro ao registar venda'),
  })

  function abrirModal() {
    setErro(''); setSucesso(false); setTotalSucesso(0)
    setMeioPagamento('dinheiro'); setNotaPagamento('')
    setGorjetaCentimos(''); setMeioGorjeta('dinheiro')
    setOfertaToda(false); setOfertaTipo('')
    setClienteSel(null)
    setAdminUserSel(null)
    setModalAberto(true)
  }

  function fecharModal() { setModalAberto(false) }

  function confirmarVenda() {
    setErro('')
    if (!ofertaToda && MEIOS_COM_NOTA_OBRIGATORIA.includes(meioPagamento) && !notaPagamento.trim()) {
      setErro(`Para "${MEIO_LABELS.find(m => m.value === meioPagamento)?.label}" é obrigatório indicar para quem ou o motivo.`)
      return
    }
    if (ofertaToda && !ofertaTipo) {
      setErro('Seleciona o tipo de oferta.')
      return
    }
    const gorjetaCent = gorjetaCentimos.trim() !== '' ? Math.round(parseFloat(gorjetaCentimos) * 100) : null

    // Guardar snapshot do total ANTES de limpar o carrinho no onSuccess
    const totalFinal = ofertaToda ? 0 : totalCentimos
    setTotalSucesso(totalFinal)

    const payload: any = {
      meio_pagamento: ofertaToda ? 'oferta' : meioPagamento,
      total_centimos: totalFinal,
      itens: carrinho.map(i => ({
        produto_id:              i.produto.id,
        quantidade:              i.quantidade,
        preco_unitario_centimos: i.produto.preco_centimos,
        oferta:                  i.oferta,
      })),
      cliente_id:   clienteSel?.id ?? null,
      notas:        notaPagamento.trim() || null,
      gorjeta:      gorjetaCent,
      meio_gorjeta: gorjetaCent ? meioGorjeta : null,
      oferta_tipo:  ofertaToda ? ofertaTipo : null,
      oferta_valor: ofertaToda ? totalBrutoCentimos : null,
    }
    if (isSA && adminUserSel) payload.admin_user_id = adminUserSel.id
    mutation.mutate(payload)
  }

  const adminUsers = (adminUsersData?.data ?? []) as AdminUser[]

  if (loadingProdutos) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Venda de Produtos</h1>
        {carrinho.length > 0 && (
          <button onClick={() => setCarrinho([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <Trash2 size={13} /> Limpar carrinho
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grelha de produtos */}
        <div className="lg:col-span-2 space-y-6">
          {porCategoria.length === 0 && (
            <Card><p className="text-sm text-gray-400 text-center py-8">Sem produtos ativos. Adiciona produtos na página de Configuração.</p></Card>
          )}
          {porCategoria.map(([categoria, produtos]) => (
            <div key={categoria}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{categoria}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produtos.map(produto => {
                  const noCarrinho = carrinho.find(i => i.produto.id === produto.id)
                  return (
                    <button key={produto.id} onClick={() => addProduto(produto)}
                      className={`relative text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                        noCarrinho ? 'border-brand-400 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm'
                      }`}>
                      {noCarrinho && (
                        <span className="absolute top-2 right-2 bg-brand-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {noCarrinho.quantidade}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-800 pr-6 leading-tight">{produto.nome}</p>
                      <p className="text-sm text-brand-600 font-bold mt-1">{(produto.preco_centimos / 100).toFixed(2)} €</p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Carrinho */}
        <div>
          <Card className="sticky top-4">
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart size={18} className="text-brand-500" />
              <h2 className="font-semibold text-gray-900">Carrinho</h2>
              {carrinho.length > 0 && (
                <span className="ml-auto text-xs bg-brand-100 text-brand-700 rounded-full px-2 py-0.5 font-medium">
                  {carrinho.length} {carrinho.length === 1 ? 'produto' : 'produtos'}
                </span>
              )}
            </div>
            {carrinho.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <ShoppingBag size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-xs">Clica num produto para adicionar</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 mb-4">
                  {carrinho.map(item => (
                    <div key={item.produto.id} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-medium truncate ${item.oferta ? 'line-through text-gray-400' : 'text-gray-800'}`}>{item.produto.nome}</p>
                        <p className="text-xs text-gray-400">{(item.produto.preco_centimos / 100).toFixed(2)} € × {item.quantidade}</p>
                      </div>
                      <button onClick={() => toggleOfertaItem(item.produto.id)}
                        title={item.oferta ? 'Remover oferta' : 'Oferecer este produto'}
                        className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                          item.oferta ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-400 hover:bg-amber-50 hover:text-amber-500'
                        }`}>
                        <Gift size={11} />
                      </button>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(item.produto.id, item.quantidade - 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Minus size={10} /></button>
                        <span className="text-xs font-semibold w-5 text-center">{item.quantidade}</span>
                        <button onClick={() => setQty(item.produto.id, item.quantidade + 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center"><Plus size={10} /></button>
                      </div>
                      <p className={`text-xs font-semibold w-14 text-right ${item.oferta ? 'text-amber-500' : 'text-gray-900'}`}>
                        {item.oferta ? '0.00 €' : ((item.produto.preco_centimos * item.quantidade) / 100).toFixed(2) + ' €'}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Total</span>
                    <span className="text-lg font-bold text-gray-900">{(totalCentimos / 100).toFixed(2)} €</span>
                  </div>
                </div>
                <button onClick={abrirModal}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors">
                  💳 Pagamento
                </button>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* Modal de checkout */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 relative">
            <button onClick={fecharModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X size={20} /></button>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Confirmar Pagamento</h2>
            <p className="text-sm text-gray-500 mb-5">
              Total: <span className="font-bold text-gray-900">{(totalBrutoCentimos / 100).toFixed(2)} €</span>
            </p>

            {sucesso ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-green-600 font-semibold">Venda registada com sucesso!</p>
                <p className="text-gray-500 text-sm mt-1">
                  Total cobrado: <span className="font-bold text-gray-900">{(totalSucesso / 100).toFixed(2)} €</span>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Resumo */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  {carrinho.map(i => (
                    <div key={i.produto.id} className="flex justify-between text-sm">
                      <span className={i.oferta ? 'text-gray-400 line-through' : 'text-gray-700'}>
                        {i.produto.nome} × {i.quantidade}
                        {i.oferta && <span className="ml-1 text-amber-500 text-xs">🎁 Oferta</span>}
                      </span>
                      <span className="font-medium">
                        {i.oferta ? '0.00 €' : ((i.produto.preco_centimos * i.quantidade) / 100).toFixed(2) + ' €'}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Oferecer tudo */}
                <div className="border border-amber-200 rounded-xl p-3 bg-amber-50 space-y-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" className="rounded" checked={ofertaToda}
                      onChange={e => { setOfertaToda(e.target.checked); if (!e.target.checked) setOfertaTipo('') }} />
                    <Gift size={14} className="text-amber-600" />
                    <span className="font-medium text-amber-800">Oferecer toda a venda</span>
                  </label>
                  {ofertaToda && (
                    <select className="input text-sm w-full" value={ofertaTipo} onChange={e => setOfertaTipo(e.target.value)}>
                      <option value="">— Tipo de oferta —</option>
                      <option value="fidelidade">Fidelidade</option>
                      <option value="desconto">Desconto</option>
                      <option value="cortesia">Cortesia</option>
                      <option value="outro">Outro</option>
                    </select>
                  )}
                </div>

                {/* Meio de pagamento */}
                {!ofertaToda && (
                  <>
                    <div>
                      <label className="label text-xs">Meio de Pagamento *</label>
                      <select className="input text-sm w-full" value={meioPagamento}
                        onChange={e => { setMeioPagamento(e.target.value); setNotaPagamento('') }}>
                        {MEIO_LABELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                      </select>
                    </div>
                    {MEIOS_COM_NOTA_OBRIGATORIA.includes(meioPagamento) && (
                      <div>
                        <label className="label text-xs">
                          Para quem / Motivo <span className="text-red-500">*</span>
                          <span className="ml-1 text-gray-400 font-normal">(obrigatório)</span>
                        </label>
                        <textarea className="input text-sm w-full resize-none" rows={2}
                          placeholder={meioPagamento === 'mbway' ? 'Ex.: MB Way para João Silva (+351 912...)' : meioPagamento === 'transferencia' ? 'Ex.: Transferência para conta X, ref. Y' : 'Descrição'}
                          value={notaPagamento} onChange={e => setNotaPagamento(e.target.value)} />
                      </div>
                    )}
                    <div className="border border-gray-100 rounded-xl p-3 space-y-2 bg-gray-50">
                      <p className="text-xs font-semibold text-gray-500">Gorjeta (opcional)</p>
                      <div className="flex gap-2">
                        <input type="number" min="0" step="0.5" placeholder="0.00"
                          className="input text-sm flex-1" value={gorjetaCentimos}
                          onChange={e => setGorjetaCentimos(e.target.value)} />
                        {gorjetaCentimos.trim() !== '' && parseFloat(gorjetaCentimos) > 0 && (
                          <select className="input text-sm w-36" value={meioGorjeta} onChange={e => setMeioGorjeta(e.target.value)}>
                            {MEIO_LABELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                          </select>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Cliente */}
                <div>
                  <label className="label text-xs">Cliente (opcional)</label>
                  <ClientSearchInput
                    selected={clienteSel}
                    onSelect={c => setClienteSel(c)}
                    onClear={() => setClienteSel(null)}
                  />
                </div>

                {/* Vendedor */}
                {isSA && (
                  <div>
                    <label className="label text-xs">Vendedor</label>
                    <select className="input text-sm w-full" value={adminUserSel?.id ?? ''}
                      onChange={e => setAdminUserSel(adminUsers.find(u => u.id === Number(e.target.value)) ?? null)}>
                      <option value="">— Usar o meu utilizador —</option>
                      {adminUsers.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                    </select>
                  </div>
                )}

                {/* Notas livres */}
                {!MEIOS_COM_NOTA_OBRIGATORIA.includes(meioPagamento) && !ofertaToda && (
                  <div>
                    <label className="label text-xs">Notas (opcional)</label>
                    <textarea className="input text-sm w-full resize-none" rows={2}
                      placeholder="Observações sobre a venda..."
                      value={notaPagamento} onChange={e => setNotaPagamento(e.target.value)} />
                  </div>
                )}

                {erro && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{erro}</p>}

                <div className="flex gap-3 pt-1">
                  <button onClick={fecharModal}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancelar</button>
                  <button onClick={confirmarVenda} disabled={mutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60">
                    {mutation.isPending ? 'A processar...' : 'Confirmar Venda'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
