/**
 * Modal de faturação via Moloni On.
 * Abre a partir do CheckoutModal quando invoicing.enabled = true.
 */
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { adminApi } from '@/api/client'
import { reservationsApi } from '@/api/reservations'
import type { Reservation, InvoiceLineItem, Service, MeioPagamento } from '@/types'
import { ClientDetailModal } from '@/components/admin/client-detail-modal'

interface Props {
    reservation: Reservation
    valorFaturar: number           // valor base (já calculado pelo checkout)
    meioPagamento?: MeioPagamento | null
    onClose: () => void
    onInvoiced: () => void         // callback após fatura emitida com sucesso
}

export function InvoicingModal({ reservation, valorFaturar, meioPagamento, onClose, onInvoiced }: Props) {
    const qc = useQueryClient()
    const clientId = reservation.client_id

    // ── Dados do cliente (sempre atualizados via React Query) ──────────────────
    const { data: clientRes } = useQuery({
        queryKey: ['client', clientId],
        queryFn: () => adminApi.get(`/api/admin/clients/${clientId}`),
        enabled: !!clientId,
    })
    const clientData = (clientRes as any)?.data as {
        id: number
        name: string
        email?: string
        nif?: number
    } | null

    const clientNifSaved = clientData?.nif ?? (reservation as any).client_nif ?? null
    const hasNif = clientNifSaved != null && String(clientNifSaved).length >= 9

    // ── Lista de serviços e produtos pré-definidos (preços tabelados) ──────────
    const { data: servicesRes } = useQuery({
        queryKey: ['invoicing-services'],
        queryFn: () => adminApi.get<Service[]>('/api/admin/services'),
    })
    const { data: productsRes } = useQuery({
        queryKey: ['invoicing-products'],
        queryFn: () => adminApi.get<any[]>('/api/admin/products'),
    })
    const services = (servicesRes?.data as unknown as Service[]) ?? []
    const products = (productsRes?.data as unknown as any[]) ?? []

    // Unifica serviços e produtos numa só lista com tipo discriminado
    const catalogItems: { id: string; label: string; price: number; description: string }[] = [
        ...services.map(s => ({
            id: `svc-${s.id}`,
            label: `${s.name} (${s.duration} min) — ${s.price.toFixed(2)} €`,
            price: s.price,
            description: s.name,
        })),
        ...products.map(p => ({
            id: `prod-${p.id}`,
            label: `${p.name} — ${Number(p.price).toFixed(2)} €`,
            price: Number(p.price),
            description: p.name,
        })),
    ]
    const [serviceToAddId, setServiceToAddId] = useState<string>('')

    // ── Preço tabelado do serviço da reserva ────────────────────────────────────
    const precoServico = valorFaturar ?? reservation.service_price ?? 0

    // ── Estado ────────────────────────────────────────────────────────────────
    const [emitirComContribuinte, setEmitirComContribuinte] = useState(true)
    const [usarNifCliente, setUsarNifCliente]               = useState(true)
    const [nifManual, setNifManual]                         = useState('')
    const [guardarNif, setGuardarNif]                       = useState(true)
    const [trocarNifCliente, setTrocarNifCliente]           = useState(false)
    const [showClientModal, setShowClientModal]             = useState(false)
    const [lines, setLines]                                 = useState<InvoiceLineItem[]>([
        { description: reservation.service_name, quantity: 1, unit_price: precoServico },
    ])
    const [saving, setSaving]                               = useState(false)
    const [error, setError]                                 = useState<string | null>(null)

    // ── Helpers de linhas ─────────────────────────────────────────────────────
    const addLine = () =>
        setLines(l => [...l, { description: '', quantity: 1, unit_price: 0 }])

    const addServiceLine = () => {
        if (serviceToAddId === '') return
        const item = catalogItems.find(c => c.id === serviceToAddId)
        if (!item) return
        setLines(l => [...l, { description: item.description, quantity: 1, unit_price: item.price }])
        setServiceToAddId('')
    }

    const updateLine = (idx: number, field: keyof InvoiceLineItem, value: string | number) =>
        setLines(l => l.map((item, i) => i === idx ? { ...item, [field]: value } : item))

    const removeLine = (idx: number) =>
        setLines(l => l.filter((_, i) => i !== idx))

    // Total a faturar é sempre a soma das linhas — automático, sem override manual
    const totalLinhas = lines.reduce((s, l) => s + l.quantity * l.unit_price, 0)

    // ── Validação ─────────────────────────────────────────────────────────────
    const validate = (): string | null => {
        if (emitirComContribuinte) {
            if (hasNif && usarNifCliente) {
                // usa NIF guardado — ok
            } else {
                const nif = nifManual.trim()
                if (!/^\d{9}$/.test(nif)) return 'NIF inválido — deve ter 9 dígitos.'
            }
        }
        if (lines.some(l => !l.description.trim())) return 'Todas as linhas precisam de descrição.'
        if (totalLinhas <= 0) return 'O total das linhas deve ser maior que zero.'
        return null
    }

    // ── Submeter ──────────────────────────────────────────────────────────────
    const handleInvoice = async () => {
        const err = validate()
        if (err) { setError(err); return }
        setSaving(true)
        try {
            const nifTrimmed = nifManual.trim()

            const nifToUse = emitirComContribuinte
                ? (hasNif && usarNifCliente ? String(clientNifSaved) : nifTrimmed)
                : null

            // Guardar/atualizar NIF no perfil do cliente conforme checkboxes
            if (emitirComContribuinte && nifTrimmed) {
                if (!hasNif && guardarNif) {
                    // cliente sem NIF → guardar novo
                    await adminApi.patch(`/api/admin/clients/${reservation.client_id}`, {
                        nif: nifTrimmed,
                    }).catch(() => {})
                } else if (hasNif && trocarNifCliente) {
                    // cliente já tinha NIF → substituir pelo novo
                    await adminApi.patch(`/api/admin/clients/${reservation.client_id}`, {
                        nif: nifTrimmed,
                    }).catch(() => {})
                }
            }

            const paymentMethodName =
                meioPagamento
                ?? reservation.meio_pagamento
                ?? 'dinheiro'

            const response = await adminApi.post('/api/admin/invoicing/emit', {
                reservation_id: reservation.id,
                customer_number: clientData?.id ?? reservation.client_id,
                nif:            nifToUse,
                customer_name:  clientData?.name ?? reservation.client_name,
                customer_email: clientData?.email ?? reservation.client_email,
                lines,
                payment_method: paymentMethodName,
            })

            // Se a API de faturação devolveu erro, mostrar no modal e não avançar
            if (!response.success) {
                const rawError = response.error
                const message =
                    typeof rawError === 'string'
                        ? rawError
                        : Array.isArray(rawError)
                            ? JSON.stringify(rawError)
                            : 'Erro ao emitir fatura. Verifica os dados na Moloni On.'
                setError(message)
                setSaving(false)
                return
            }

            try {
                await reservationsApi.update(reservation.id, { status: 'concluida' })
            } catch (statusErr) {
                console.error('[InvoicingModal] falha ao atualizar estado da reserva para concluída:', statusErr)
            }

            qc.invalidateQueries({ queryKey: ['reservations'] })
            qc.invalidateQueries({ queryKey: ['client', reservation.client_id] })
            onInvoiced()
        } catch (e: any) {
            setError(e?.message ?? 'Erro ao emitir fatura. Verifica a ligação à Moloni On.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <Modal
                open
                onClose={onClose}
                title="🧾 Emitir Fatura"
                footer={
                    <>
                        <button className="btn-secondary text-sm" onClick={onClose}>Cancelar</button>
                        <button
                            className="text-sm px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors disabled:opacity-50"
                            onClick={handleInvoice}
                            disabled={saving}
                        >
                            {saving ? 'A emitir...' : '🧾 Guardar e Faturar'}
                        </button>
                    </>
                }
            >
                <div className="space-y-4 text-sm">

                    {/* Dados do cliente */}
                    <div className="bg-gray-50 rounded-lg px-3 py-2 space-y-1">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-400">Cliente</p>
                            <button
                                type="button"
                                onClick={() => setShowClientModal(true)}
                                className="text-xs text-blue-500 hover:underline"
                            >
                                ✏️ Editar dados
                            </button>
                        </div>
                        <p className="font-medium">{clientData?.name ?? reservation.client_name}</p>
                        {(clientData?.email ?? reservation.client_email) && (
                            <p className="text-xs text-gray-500">{clientData?.email ?? reservation.client_email}</p>
                        )}
                    </div>

                    {/* Opção: emitir com contribuinte */}
                    <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
                        <input
                            type="checkbox"
                            checked={emitirComContribuinte}
                            onChange={e => setEmitirComContribuinte(e.target.checked)}
                            className="rounded"
                        />
                        Emitir fatura com contribuinte
                    </label>

                    {/* Sub-opções do contribuinte */}
                    {emitirComContribuinte && (
                        <div className="pl-5 border-l-2 border-orange-200 space-y-3">
                            {hasNif ? (
                                <div className="space-y-2">
                                    {/* Toggle: usar diretamente o NIF do cliente */}
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                                        <input
                                            type="checkbox"
                                            checked={usarNifCliente}
                                            onChange={e => {
                                                const checked = e.target.checked
                                                setUsarNifCliente(checked)
                                                if (checked) {
                                                    setNifManual('')
                                                    setTrocarNifCliente(false)
                                                }
                                            }}
                                            className="rounded"
                                        />
                                        Emitir com NIF do cliente
                                        <span className="text-gray-400 font-mono ml-1">({clientNifSaved})</span>
                                    </label>

                                    {/* Quando NÃO se quer usar o NIF do cliente, pedir NIF manual */}
                                    {!usarNifCliente && (
                                        <div className="pl-5 border-l border-orange-200 space-y-2">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">
                                                    NIF a associar à fatura
                                                </label>
                                                <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={9}
                                                    className="input text-sm w-full"
                                                    placeholder="123456789"
                                                    value={nifManual}
                                                    onChange={e => {
                                                        setNifManual(e.target.value.replace(/\D/g, ''))
                                                        setError(null)
                                                    }}
                                                />
                                            </div>
                                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                                                <input
                                                    type="checkbox"
                                                    checked={trocarNifCliente}
                                                    onChange={e => setTrocarNifCliente(e.target.checked)}
                                                    className="rounded"
                                                />
                                                Atualizar NIF do cliente para este novo NIF
                                            </label>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                /* Cliente NÃO tem NIF — mostrar campo */
                                <div className="space-y-2">
                                    <div>
                                        <label className="block text-xs text-gray-500 mb-1">NIF do cliente</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={9}
                                            className="input text-sm w-full"
                                            placeholder="123456789"
                                            value={nifManual}
                                            onChange={e => { setNifManual(e.target.value.replace(/\D/g, '')); setError(null) }}
                                        />
                                    </div>
                                    <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                                        <input
                                            type="checkbox"
                                            checked={guardarNif}
                                            onChange={e => setGuardarNif(e.target.checked)}
                                            className="rounded"
                                        />
                                        Guardar NIF no perfil do cliente
                                    </label>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Serviços / linhas da fatura */}
                    <div>
                        {/* Cabeçalho das colunas */}
                        <div className="grid grid-cols-[1fr_60px_80px_28px] gap-2 px-0.5 mb-1">
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">Descrição</span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-center">Qtd.</span>
                            <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide text-right">Preço (€)</span>
                            <span />
                        </div>

                        <div className="space-y-2">
                            {lines.map((line, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_60px_80px_28px] gap-2 items-center">
                                    <input
                                        className="input text-xs"
                                        placeholder="Descrição"
                                        value={line.description}
                                        onChange={e => updateLine(idx, 'description', e.target.value)}
                                    />
                                    <input
                                        type="number" min={1} step={1}
                                        className="input text-xs text-center"
                                        title="Quantidade"
                                        value={line.quantity}
                                        onChange={e => updateLine(idx, 'quantity', Math.max(1, Number(e.target.value)))}
                                    />
                                    <input
                                        type="number" min={0} step={0.5}
                                        className="input text-xs text-right"
                                        title="Preço unit. (€)"
                                        value={line.unit_price}
                                        onChange={e => updateLine(idx, 'unit_price', Number(e.target.value))}
                                    />
                                    {lines.length > 1 ? (
                                        <button
                                            type="button"
                                            onClick={() => removeLine(idx)}
                                            className="text-red-400 hover:text-red-600 text-lg leading-none"
                                            title="Remover linha"
                                        >×</button>
                                    ) : <span />}
                                </div>
                            ))}
                        </div>

                        {/* Adicionar a partir de lista pré-definida (serviços/produtos tabelados) */}
                        <div className="mt-2 flex gap-2 items-center">
                            <select
                                className="input text-xs flex-1 bg-white"
                                value={serviceToAddId}
                                onChange={e => setServiceToAddId(e.target.value)}
                            >
                                <option value="">Escolher serviço/produto…</option>
                                {catalogItems.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="text-xs px-2 py-1 rounded-lg bg-gray-900 text-white disabled:opacity-40"
                                disabled={serviceToAddId === '' || catalogItems.length === 0}
                                onClick={addServiceLine}
                            >
                                Adicionar à fatura
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={addLine}
                            className="mt-2 text-xs text-blue-500 hover:underline"
                        >
                            + Adicionar linha manual
                        </button>

                        <div className="mt-2 flex justify-between text-xs text-gray-500">
                            <span>Total a faturar:</span>
                            <span className="font-medium text-gray-700">{totalLinhas.toFixed(2)} €</span>
                        </div>
                    </div>

                    {error && (
                        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                            {error}
                        </p>
                    )}
                </div>
            </Modal>

            {/* Modal de edição de dados do cliente (reutiliza o modal já existente) */}
            {showClientModal && reservation.client_id && (
                <ClientDetailModal
                    clientId={reservation.client_id}
                    initialClient={clientData ?? undefined}
                    onClose={() => {
                        setShowClientModal(false)
                        // atualiza os dados deste cliente na cache do modal de faturação
                        qc.invalidateQueries({ queryKey: ['client', reservation.client_id] })
                    }}
                />
            )}
        </>
    )
}