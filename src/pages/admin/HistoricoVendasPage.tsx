import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { useAdminUser, isSuperAdmin } from '@/hooks/useAdminUser'
import { Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import { ChevronDown, ChevronUp } from 'lucide-react'

const MEIO_LABEL: Record<string, string> = {
  multibanco:    '💳 Multibanco',
  dinheiro:      '💵 Dinheiro',
  mbway:         '📱 MB Way',
  transferencia: '🏦 Transferência',
  outro:         '❓ Outro',
}

function fmt(centimos: number) {
  return (centimos / 100).toFixed(2) + ' €'
}

export default function HistoricoVendasPage() {
  const adminUser = useAdminUser()
  const isSA      = isSuperAdmin(adminUser)

  // Apenas superAdmin pode aceder
  if (!isSA) return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />

  return <HistoricoVendasContent />
}

function HistoricoVendasContent() {
  const now      = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const today    = now.toISOString().slice(0, 10)

  const [dateFrom,     setDateFrom]     = useState(firstDay)
  const [dateTo,       setDateTo]       = useState(today)
  const [adminUserId,  setAdminUserId]  = useState('')
  const [expandedId,   setExpandedId]   = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['produto-vendas', dateFrom, dateTo, adminUserId],
    queryFn: () => {
      let url = `/api/admin/produto-vendas?data_inicio=${dateFrom}&data_fim=${dateTo}`
      if (adminUserId) url += `&admin_user_id=${adminUserId}`
      return adminApi.get<any[]>(url)
    },
  })

  const { data: adminUsersData } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn:  () => adminApi.get<any[]>('/api/admin/admin-users'),
  })

  const vendas      = (data?.data      ?? []) as any[]
  const adminUsers  = (adminUsersData?.data ?? []) as any[]

  const totalGeral  = vendas.reduce((acc: number, v: any) => acc + (v.total_centimos ?? 0), 0)

  if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-gray-900">Histórico de Vendas</h1>

      {/* Filtros */}
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
              {adminUsers.map((u: any) => (
                <option key={u.id} value={u.id}>{u.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            {[
              { label: 'Este mês',    from: firstDay, to: today },
              { label: 'Mês passado', from: (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toISOString().slice(0,10) })(), to: (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0,10) })() },
              { label: 'Este ano',    from: `${now.getFullYear()}-01-01`, to: today },
            ].map(p => (
              <button key={p.label} onClick={() => { setDateFrom(p.from); setDateTo(p.to) }}
                className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors">
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card>
          <p className="text-xs text-gray-500 mb-1">Total vendido</p>
          <p className="text-xl font-bold text-gray-900">{fmt(totalGeral)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Nº de vendas</p>
          <p className="text-xl font-bold text-gray-900">{vendas.length}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 mb-1">Média por venda</p>
          <p className="text-xl font-bold text-gray-900">
            {vendas.length > 0 ? fmt(Math.round(totalGeral / vendas.length)) : '—'}
          </p>
        </Card>
      </div>

      {/* Tabela */}
      <Card padding="none">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-sm">Detalhe das vendas</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Data', 'Vendedor', 'Cliente', 'Meio Pag.', 'Total', 'Notas', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vendas.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-gray-400 py-8 text-xs">
                    Sem vendas no período selecionado
                  </td>
                </tr>
              )}
              {vendas.map((v: any) => (
                <>
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {format(parseISO(v.criado_em), "d MMM yyyy HH:mm", { locale: pt })}
                    </td>
                    <td className="px-4 py-3">{v.admin_user_nome}</td>
                    <td className="px-4 py-3">{v.cliente_nome ?? <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-xs">{MEIO_LABEL[v.meio_pagamento] ?? v.meio_pagamento}</td>
                    <td className="px-4 py-3 font-semibold">{fmt(v.total_centimos)}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{v.notas ?? '—'}</td>
                    <td className="px-4 py-3">
                      {v.itens?.length > 0 && (
                        <button
                          onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                          className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-600 flex items-center gap-1"
                        >
                          {expandedId === v.id ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {v.itens.length} {v.itens.length === 1 ? 'item' : 'itens'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === v.id && (
                    <tr key={`${v.id}-itens`} className="bg-gray-50">
                      <td colSpan={7} className="px-8 py-3">
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
                                <td className="py-1 text-right font-medium">
                                  {fmt(item.preco_unitario_centimos * item.quantidade)}
                                </td>
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
    </div>
  )
}

const now = new Date()
