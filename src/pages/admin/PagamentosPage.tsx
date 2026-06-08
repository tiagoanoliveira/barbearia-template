import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { adminApi } from '@/api/client'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import { CheckoutModal } from '@/components/admin/reservation-modals'
import type { Reservation } from '@/types'

const MEIO_LABEL: Record<string, string> = {
  multibanco: '💳 Multibanco',
  dinheiro:   '💵 Dinheiro',
  outro:      '❓ Outro',
}

const OFERTA_TIPO_LABEL: Record<string, string> = {
  fidelidade: 'Fidelidade',
  desconto:   'Desconto',
  cortesia:   'Cortesia',
  outro:      'Outro',
}

function fmt(val: number | null | undefined) {
  return val != null ? `${Number(val).toFixed(2)} €` : '—'
}

/**
 * Calcula o valor total efectivo da transacção:
 * valor_pago (cobrado ao cliente) + oferta_valor (desconto/oferta aplicada)
 * = preço total do serviço prestado
 */
function calcValorTotal(r: any): number {
  const pago   = Number(r.valor_pago   ?? 0)
  const oferta = Number(r.oferta_valor ?? 0)
  return pago + oferta
}

/**
 * Devolve a string de método(s) de pagamento para a coluna PAGAMENTO,
 * incluindo o valor de cada parte.
 *
 * Exemplos:
 *   Oferta total          → "🏷️ Oferta Cortesia (10.00€)"
 *   Oferta + Multibanco   → "🏷️ Oferta Fidelidade (5.00€), 💳 Multibanco (5.00€)"
 *   Só Multibanco         → "💳 Multibanco (10.00€)"
 */
function formatMeioPagamento(r: any): string {
  const parts: string[] = []

  if (r.oferta_tipo) {
    const tipoLabel = OFERTA_TIPO_LABEL[r.oferta_tipo] ?? r.oferta_tipo
    const ofertaValor = Number(r.oferta_valor ?? 0)
    parts.push(`🏷️ Oferta ${tipoLabel} (${ofertaValor.toFixed(2)}€)`)
  }

  if (r.meio_pagamento) {
    const meioLabel = MEIO_LABEL[r.meio_pagamento] ?? r.meio_pagamento
    const valorPago = Number(r.valor_pago ?? 0)
    parts.push(`${meioLabel} (${valorPago.toFixed(2)}€)`)
  }

  return parts.length > 0 ? parts.join(', ') : '—'
}

export default function PagamentosPage() {
  const now      = new Date()
  const firstDay = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
  const today    = now.toISOString().slice(0, 10)

  const [dateFrom, setDateFrom] = useState(firstDay)
  const [dateTo,   setDateTo]   = useState(today)

  const [editingPayment, setEditingPayment] = useState<Reservation | null>(null)
  const qc = useQueryClient()

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
      <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
        {[
          { label: 'Total faturado',    value: fmt(d?.totais?.total_faturado),  sub: '(c/ ofertas)' },
          { label: 'Total cobrado',    value: fmt(d?.totais?.total_recebido),  sub: '(sem ofertas)' },
          { label: 'Total em ofertas',  value: fmt(d?.totais?.total_ofertas),   sub: null },
          { label: 'Total gorjetas',    value: fmt(d?.totais?.total_gorjetas),  sub: null },
          { label: 'Reservas pagas',    value: d?.totais?.total_reservas ?? '—', sub: null },
          { label: 'Média por reserva', value: fmt(d?.totais?.media_por_reserva), sub: '(c/ ofertas)' },
        ].map(k => (
          <Card key={k.label}>
            <p className="text-xs text-gray-500 mb-1">
              {k.label}{k.sub && <span className="text-gray-400 ml-1">{k.sub}</span>}
            </p>
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
          <div className="space-y-3">
            {d?.porBarbeiro?.map((b: any) => (
              <div key={b.barbeiro_nome}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-2 h-2 rounded-full inline-block" style={{ background: b.barbeiro_color ?? '#888' }} />
                  <span className="text-sm font-semibold text-gray-800">{b.barbeiro_nome}</span>
                  {/* Total faturado (recebido + ofertas) */}
                  <span className="ml-auto text-sm font-bold text-gray-900">{fmt(b.total_valor)}</span>
                </div>
                <div className="pl-3.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-500">
                  <span>💵 {fmt(b.total_dinheiro)}</span>
                  <span>💳 {fmt(b.total_multibanco)}</span>
                  {b.total_outro > 0 && (
                      <span>❓ Outro: {fmt(b.total_outro)}</span>
                  )}
                  <span className="text-emerald-600 font-medium">Total Cobrado: {fmt(b.total_recebido)}</span>
                  {b.total_ofertas > 0 && (
                      <span className="text-amber-600 font-medium">🏷️ Ofertas: {fmt(b.total_ofertas)}</span>
                  )}
                  {b.total_gorjetas > 0 && <span>🎁 {fmt(b.total_gorjetas)}</span>}
                </div>
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
                {['Data','Cliente','Barbeiro','Serviço','Valor','Pagamento','Gorjeta',''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {d?.detalhe?.length === 0 && (
                <tr><td colSpan={8} className="text-center text-gray-400 py-8 text-xs">Sem registos no período selecionado</td></tr>
              )}
              {d?.detalhe?.map((r: any) => {
                const valorTotal = calcValorTotal(r)
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{format(parseISO(r.data_hora), "d MMM yyyy HH:mm", { locale: pt })}</td>
                    <td className="px-4 py-3">{r.cliente_nome}</td>
                    <td className="px-4 py-3">{r.barbeiro_nome}</td>
                    <td className="px-4 py-3">{r.servico_nome}</td>
                    <td className="px-4 py-3 font-medium">{fmt(valorTotal)}</td>
                    <td className="px-4 py-3 text-xs">{formatMeioPagamento(r)}</td>
                    <td className="px-4 py-3 text-xs">{r.gorjeta ? `${fmt(r.gorjeta)} (${MEIO_LABEL[r.meio_gorjeta] ?? r.meio_gorjeta})` : '—'}</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditingPayment({
                          id:                       r.id,
                          client_name:              r.cliente_nome,
                          service_name:             r.servico_nome,
                          service_price:            valorTotal,
                          meio_pagamento:           r.meio_pagamento,
                          valor_pago:               r.valor_pago,
                          gorjeta:                  r.gorjeta,
                          meio_gorjeta:             r.meio_gorjeta,
                          comentario_pagamento:     r.comentario_pagamento,
                          oferta_tipo:              r.oferta_tipo   ?? null,
                          oferta_valor:             r.oferta_valor  ?? null,
                          client_free_reservations: 0,
                        } as Reservation)}
                        className="text-xs px-2 py-1 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 font-medium whitespace-nowrap"
                      >
                        💳 Editar
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de edição de pagamento */}
      {editingPayment && (
        <CheckoutModal
          reservation={editingPayment}
          invalidateKey="pagamentos"
          onClose={() => { setEditingPayment(null); qc.invalidateQueries({ queryKey: ['pagamentos', dateFrom, dateTo] }) }}
          editMode
        />
      )}
    </div>
  )
}
