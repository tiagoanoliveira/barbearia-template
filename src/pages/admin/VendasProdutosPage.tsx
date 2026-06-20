import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { ShoppingCart, Plus, Minus, Trash2, X, ShoppingBag } from 'lucide-react'
import { useAdminUser, isSuperAdmin } from '@/hooks/useAdminUser'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'

const MEIO_LABELS = [
  { value: 'dinheiro',    label: '💵 Dinheiro' },
  { value: 'multibanco',  label: '💳 Multibanco' },
  { value: 'mbway',       label: '📱 MB Way' },
  { value: 'transferencia', label: '🏦 Transferência' },
  { value: 'outro',       label: '❓ Outro' },
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
}

interface Cliente {
  id: number
  nome: string
  telefone?: string
}

interface AdminUser {
  id: number
  nome: string
}

export default function VendasProdutosPage() {
  const adminUser = useAdminUser()
  const isBarber  = adminUser?.role === 'barbeiro'

  // Barbeiros não têm acesso a vendas de produtos
  if (isBarber) return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />

  return <VendasProdutosContent />
}

function VendasProdutosContent() {
  const adminUser = useAdminUser()
  const qc = useQueryClient()

  const [carrinho, setCarrinho] = useState<CarrinhoItem[]>([])
  const [modalAberto, setModalAberto] = useState(false)

  // Dados do modal de pagamento
  const [meioPagamento, setMeioPagamento] = useState('dinheiro')
  const [clienteQuery,  setClienteQuery]  = useState('')
  const [clienteSel,    setClienteSel]    = useState<Cliente | null>(null)
  const [adminUserSel,  setAdminUserSel]  = useState<AdminUser | null>(null)
  const [notas,         setNotas]         = useState('')
  const [erro,          setErro]          = useState('')
  const [sucesso,       setSucesso]       = useState(false)

  const isSA = isSuperAdmin(adminUser)

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: produtosData, isLoading: loadingProdutos } = useQuery({
    queryKey: ['produtos-ativos'],
    queryFn:  () => adminApi.get<Produto[]>('/api/admin/produtos?ativo=1'),
  })

  const { data: clientesData } = useQuery({
    queryKey: ['clientes-search', clienteQuery],
    queryFn:  () => adminApi.get<Cliente[]>(`/api/admin/clients?search=${encodeURIComponent(clienteQuery)}&limit=10`),
    enabled:  clienteQuery.length >= 2,
  })

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn:  () => adminApi.get<AdminUser[]>('/api/admin/admin-users'),
    enabled:  isSA,
  })

  // ── Agrupamento por categoria ─────────────────────────────────────────────
  const porCategoria = useMemo(() => {
    const produtos = (produtosData?.data ?? []) as Produto[]
    const mapa: Record<string, Produto[]> = {}
    for (const p of produtos) {
      if (!mapa[p.categoria_nome]) mapa[p.categoria_nome] = []
      mapa[p.categoria_nome].push(p)
    }
    return Object.entries(mapa).sort(([a], [b]) => a.localeCompare(b))
  }, [produtosData])

  // ── Carrinho helpers ──────────────────────────────────────────────────────
  const totalCentimos = carrinho.reduce((acc, i) => acc + i.produto.preco_centimos * i.quantidade, 0)

  function addProduto(produto: Produto) {
    setCarrinho(prev => {
      const idx = prev.findIndex(i => i.produto.id === produto.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = { ...next[idx], quantidade: next[idx].quantidade + 1 }
        return next
      }
      return [...prev, { produto, quantidade: 1 }]
    })
  }

  function setQty(produtoId: number, qty: number) {
    if (qty <= 0) {
      setCarrinho(prev => prev.filter(i => i.produto.id !== produtoId))
    } else {
      setCarrinho(prev => prev.map(i => i.produto.id === produtoId ? { ...i, quantidade: qty } : i))
    }
  }

  function limparCarrinho() {
    setCarrinho([])
  }

  // ── Mutation — registar venda ─────────────────────────────────────────────
  const mutation = useMutation({
    mutationFn: (payload: object) => adminApi.post('/api/admin/produto-vendas', payload),
    onSuccess: () => {
      setSucesso(true)
      setCarrinho([])
      qc.invalidateQueries({ queryKey: ['produto-vendas'] })
      setTimeout(() => {
        setSucesso(false)
        fecharModal()
      }, 1800)
    },
    onError: (e: any) => {
      setErro(e?.message ?? 'Erro ao registar venda')
    },
  })

  function abrirModal() {
    setErro('')
    setSucesso(false)
    setMeioPagamento('dinheiro')
    setClienteQuery('')
    setClienteSel(null)
    setAdminUserSel(null)
    setNotas('')
    setModalAberto(true)
  }

  function fecharModal() {
    setModalAberto(false)
  }

  function confirmarVenda() {
    setErro('')
    if (!meioPagamento) { setErro('Selecione o meio de pagamento'); return }
    const payload: any = {
      meio_pagamento: meioPagamento,
      itens: carrinho.map(i => ({
        produto_id: i.produto.id,
        quantidade: i.quantidade,
        preco_unitario_centimos: i.produto.preco_centimos,
      })),
      cliente_id:    clienteSel?.id    ?? null,
      notas:         notas             || null,
    }
    if (isSA && adminUserSel) payload.admin_user_id = adminUserSel.id
    mutation.mutate(payload)
  }

  const clientes    = (clientesData?.data   ?? []) as Cliente[]
  const adminUsers  = (adminUsersData?.data ?? []) as AdminUser[]

  if (loadingProdutos) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Venda de Produtos</h1>
        {carrinho.length > 0 && (
          <button onClick={limparCarrinho} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
            <Trash2 size={13} /> Limpar carrinho
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Grelha de produtos ── */}
        <div className="lg:col-span-2 space-y-6">
          {porCategoria.length === 0 && (
            <Card>
              <p className="text-sm text-gray-400 text-center py-8">
                Sem produtos ativos. Adiciona produtos na página de Configuração.
              </p>
            </Card>
          )}
          {porCategoria.map(([categoria, produtos]) => (
            <div key={categoria}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{categoria}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {produtos.map(produto => {
                  const noCarrinho = carrinho.find(i => i.produto.id === produto.id)
                  return (
                    <button
                      key={produto.id}
                      onClick={() => addProduto(produto)}
                      className={`relative text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                        noCarrinho
                          ? 'border-brand-400 bg-brand-50'
                          : 'border-gray-200 bg-white hover:border-brand-300 hover:shadow-sm'
                      }`}
                    >
                      {noCarrinho && (
                        <span className="absolute top-2 right-2 bg-brand-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                          {noCarrinho.quantidade}
                        </span>
                      )}
                      <p className="text-sm font-semibold text-gray-800 pr-6 leading-tight">{produto.nome}</p>
                      <p className="text-sm text-brand-600 font-bold mt-1">
                        {(produto.preco_centimos / 100).toFixed(2)} €
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── Carrinho ── */}
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
                        <p className="text-xs font-medium text-gray-800 truncate">{item.produto.nome}</p>
                        <p className="text-xs text-gray-400">{(item.produto.preco_centimos / 100).toFixed(2)} € × {item.quantidade}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setQty(item.produto.id, item.quantidade - 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                          <Minus size={10} />
                        </button>
                        <span className="text-xs font-semibold w-5 text-center">{item.quantidade}</span>
                        <button onClick={() => setQty(item.produto.id, item.quantidade + 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center">
                          <Plus size={10} />
                        </button>
                      </div>
                      <p className="text-xs font-semibold text-gray-900 w-14 text-right">
                        {((item.produto.preco_centimos * item.quantidade) / 100).toFixed(2)} €
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

                <button
                  onClick={abrirModal}
                  className="w-full py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors"
                >
                  💳 Pagamento
                </button>
              </>
            )}
          </Card>
        </div>
      </div>

      {/* ── Modal de pagamento ── */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 relative">
            <button onClick={fecharModal} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>

            <h2 className="text-lg font-bold text-gray-900 mb-1">Confirmar Pagamento</h2>
            <p className="text-sm text-gray-500 mb-5">
              Total: <span className="font-bold text-gray-900">{(totalCentimos / 100).toFixed(2)} €</span>
            </p>

            {sucesso ? (
              <div className="text-center py-6">
                <p className="text-2xl mb-2">✅</p>
                <p className="text-green-600 font-semibold">Venda registada com sucesso!</p>
              </div>
            ) : (
              <div className="space-y-4">

                {/* Resumo do carrinho */}
                <div className="bg-gray-50 rounded-xl p-3 space-y-1">
                  {carrinho.map(i => (
                    <div key={i.produto.id} className="flex justify-between text-sm">
                      <span className="text-gray-700">{i.produto.nome} × {i.quantidade}</span>
                      <span className="font-medium">{((i.produto.preco_centimos * i.quantidade) / 100).toFixed(2)} €</span>
                    </div>
                  ))}
                </div>

                {/* Meio de pagamento */}
                <div>
                  <label className="label text-xs">Meio de Pagamento *</label>
                  <select
                    className="input text-sm w-full"
                    value={meioPagamento}
                    onChange={e => setMeioPagamento(e.target.value)}
                  >
                    {MEIO_LABELS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>

                {/* Cliente (opcional) */}
                <div>
                  <label className="label text-xs">Cliente (opcional)</label>
                  {clienteSel ? (
                    <div className="flex items-center gap-2 px-3 py-2 bg-brand-50 border border-brand-200 rounded-xl">
                      <span className="text-sm font-medium text-brand-800 flex-1">{clienteSel.nome}</span>
                      <button onClick={() => setClienteSel(null)} className="text-brand-400 hover:text-brand-600">
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        type="text"
                        className="input text-sm w-full"
                        placeholder="Pesquisar cliente..."
                        value={clienteQuery}
                        onChange={e => setClienteQuery(e.target.value)}
                      />
                      {clientes.length > 0 && clienteQuery.length >= 2 && (
                        <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-xl shadow-lg mt-1 max-h-40 overflow-y-auto">
                          {clientes.map(c => (
                            <button
                              key={c.id}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-brand-50 hover:text-brand-700"
                              onClick={() => { setClienteSel(c); setClienteQuery('') }}
                            >
                              {c.nome} {c.telefone ? <span className="text-gray-400">· {c.telefone}</span> : null}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Vendedor (superAdmin pode alterar) */}
                {isSA && (
                  <div>
                    <label className="label text-xs">Vendedor</label>
                    <select
                      className="input text-sm w-full"
                      value={adminUserSel?.id ?? ''}
                      onChange={e => {
                        const found = adminUsers.find(u => u.id === Number(e.target.value))
                        setAdminUserSel(found ?? null)
                      }}
                    >
                      <option value="">— Usar o meu utilizador —</option>
                      {adminUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Notas */}
                <div>
                  <label className="label text-xs">Notas (opcional)</label>
                  <textarea
                    className="input text-sm w-full resize-none"
                    rows={2}
                    placeholder="Observações sobre a venda..."
                    value={notas}
                    onChange={e => setNotas(e.target.value)}
                  />
                </div>

                {erro && (
                  <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{erro}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={fecharModal}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={confirmarVenda}
                    disabled={mutation.isPending}
                    className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold transition-colors disabled:opacity-60"
                  >
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
