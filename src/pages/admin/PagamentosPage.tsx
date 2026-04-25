import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'

const MEIO_LABEL: Record<string, string> = {
    multibanco: '💳 Multibanco',
    dinheiro:   '💵 Dinheiro',
    outro:      'Outro',
}

function fmt(val: number | null | undefined) {
    return val != null ? `${Number(val).toFixed(2)} €` : '—'
}

export default function PagamentosPage() {
    const now     = new Date()
    const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const today    = now.toISOString().slice(0, 10)

    const [dateFrom, setDateFrom] = useState(firstDay)
    const [dateTo,   setDateTo]   = useState(today)

    const { data, isLoading } = useQuery({
        queryKey: ['pagamentos', dateFrom, dateTo],
        queryFn:  () => adminApi.get<any>(`/api/admin/pagamentos?date_from=${dateFrom}&date_to=${dateTo}`),
    })

    const d = data?.data
    if (isLoading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>

    return (
        <div className="space-y-6">
            {/* Filtro de período */}
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
                    {/* Atalhos rápidos */}
                    <div className="flex gap-2">
                        {[
                            { label: 'Este mês',   from: firstDay, to: today },
                            { label: 'Mês passado', from: (() => { const d = new Date(now.getFullYear(), now.getMonth()-1, 1); return d.toISOString().slice(0,10) })(),
                                to: (() => { const d = new Date(now.getFullYear(), now.getMonth(), 0); return d.toISOString().slice(0,10) })() },
                            { label: 'Este ano',   from: `${now.getFullYear()}-01-01`, to: today },
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
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Total faturado',   value: fmt(d?.totais?.total_faturado) },
                    { label: 'Total gorjetas',   value: fmt(d?.totais?.total_gorjetas) },
                    { label: 'Reservas pagas',   value: d?.totais?.total_reservas ?? '—' },
                    { label: 'Média por reserva',value: fmt(d?.totais?.media_por_reserva) },
                ].map(k => (
                    <Card key={k.label}>
                        <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                        <p className="text-xl font-bold text-gray-900">{k.value}</p>
                    </Card>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Por meio de pagamento */}
                <Card>
                    <h3 className="font-semibold text-sm mb-3">Por meio de pagamento</h3>
                    <div className="space-y-2">
                        {d?.porMeio?.map((m: any) => (
                            <div key={m.meio_pagamento} className="flex justify-between text-sm">
                                <span>{MEIO_LABEL[m.meio_pagamento] ?? m.meio_pagamento}</span>
                                <span className="font-medium">{fmt(m.total_valor)}</span>
                            </div>
                        )) ?? <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>
                </Card>

                {/* Por barbeiro */}
                <Card>
                    <h3 className="font-semibold text-sm mb-3">Por barbeiro</h3>
                    <div className="space-y-2">
                        {d?.porBarbeiro?.map((b: any) => (
                            <div key={b.barbeiro_nome} className="flex justify-between text-sm">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: b.barbeiro_color ?? '#888' }} />
                    {b.barbeiro_nome}
                </span>
                                <span className="font-medium">{fmt(b.total_valor)}</span>
                            </div>
                        )) ?? <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>
                </Card>

                {/* Por serviço */}
                <Card>
                    <h3 className="font-semibold text-sm mb-3">Por serviço</h3>
                    <div className="space-y-2">
                        {d?.porServico?.map((s: any) => (
                            <div key={s.servico_nome} className="flex justify-between text-sm">
                                <span>{s.servico_nome}</span>
                                <span className="font-medium">{fmt(s.total_valor)}</span>
                            </div>
                        )) ?? <p className="text-xs text-gray-400">Sem dados</p>}
                    </div>
                </Card>
            </div>

            {/* Tabela de detalhe */}
            <Card padding="none">
                <div className="px-5 py-3 border-b border-gray-100">
                    <h3 className="font-semibold text-sm">Detalhe das transações</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b border-gray-100">
                            {['Data','Cliente','Barbeiro','Serviço','Valor','Pagamento','Gorjeta'].map(h => (
                                <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                        {d?.detalhe?.length === 0 && (
                            <tr><td colSpan={7} className="text-center text-gray-400 py-8 text-xs">Sem registos no período selecionado</td></tr>
                        )}
                        {d?.detalhe?.map((r: any) => (
                            <tr key={r.id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-xs text-gray-500">
                                    {format(parseISO(r.data_hora), "d MMM yyyy HH:mm", { locale: pt })}
                                </td>
                                <td className="px-4 py-3">{r.cliente_nome}</td>
                                <td className="px-4 py-3">{r.barbeiro_nome}</td>
                                <td className="px-4 py-3">{r.servico_nome}</td>
                                <td className="px-4 py-3 font-medium">{fmt(r.valor_pago)}</td>
                                <td className="px-4 py-3">{MEIO_LABEL[r.meio_pagamento] ?? r.meio_pagamento}</td>
                                <td className="px-4 py-3">
                                    {r.gorjeta ? `${fmt(r.gorjeta)} (${MEIO_LABEL[r.meio_gorjeta] ?? r.meio_gorjeta})` : '—'}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    )
}