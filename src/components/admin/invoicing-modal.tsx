/**
 * Modal de faturação via Moloni On.
 * Abre a partir do CheckoutModal quando invoicing.enabled = true.
 */
import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import Modal from '@/components/ui/Modal'
import { adminApi } from '@/api/client'
import type { Reservation, InvoiceLineItem } from '@/types'

interface Props {
    reservation: Reservation
    valorFaturar: number           // valor base (já calculado pelo checkout)
    onClose: () => void
    onInvoiced: () => void         // callback após fatura emitida com sucesso
}

export function InvoicingModal({ reservation, valorFaturar, onClose, onInvoiced }: Props) {
    const qc = useQueryClient()

    // ── Dados do cliente ──────────────────────────────────────────────────────
    const clientNifSaved = (reservation as any).client_nif as number | null | undefined
    const hasNif = clientNifSaved != null && String(clientNifSaved).length >= 9

    // ── Estado ────────────────────────────────────────────────────────────────
    const [emitirComContribuinte, setEmitirComContribuinte] = useState(true)
    const [usarNifCliente, setUsarNifCliente]               = useState(true)
    const [nifManual, setNifManual]                         = useState('')
    const [guardarNif, setGuardarNif]                       = useState(true)
    const [lines, setLines]                                 = useState<InvoiceLineItem[]>([
        { description: reservation.service_name, quantity: 1, unit_price: valorFaturar },
    ])
    const [valorOverride, setValorOverride]                 = useState<number>(valorFaturar)
    const [saving, setSaving]                               = useState(false)
    const [error, setError]                                 = useState<string | null>(null)

    // ── Helpers de linhas ─────────────────────────────────────────────────────
    const addLine = () =>
        setLines(l => [...l, { description: '', quantity: 1, unit_price: 0 }])

    const updateLine = (idx: number, field: keyof InvoiceLineItem, value: string | number) =>
        setLines(l => l.map((item, i) => i === idx ? { ...item, [field]: value } : item))

    const removeLine = (idx: number) =>
        setLines(l => l.filter((_, i) => i !== idx))

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
        if (valorOverride <= 0) return 'O valor a faturar deve ser maior que zero.'
        return null
    }

    // ── Submeter ──────────────────────────────────────────────────────────────
    const handleInvoice = async () => {
        const err = validate()
        if (err) { setError(err); return }
        setSaving(true)
        try {
            const nifToUse = emitirComContribuinte
                ? (hasNif && usarNifCliente ? String(clientNifSaved) : nifManual.trim())
                : null

            // Guardar NIF no perfil se solicitado e não havia NIF
            if (emitirComContribuinte && !hasNif && guardarNif && nifManual.trim()) {
                await adminApi.patch(`/api/admin/clients/${reservation.client_id}`, {
                    nif: nifManual.trim(),
                }).catch(() => {})
            }

            // Chamar API de faturação (Moloni On)
            await adminApi.post('/api/admin/invoicing/emit', {
                reservation_id: reservation.id,
                nif:            nifToUse,
                customer_name:  reservation.client_name,
                customer_email: reservation.client_email,
                lines,
                total_override: valorOverride,
            })

            qc.invalidateQueries({ queryKey: ['reservations'] })
            onInvoiced()
        } catch (e: any) {
            setError(e?.message ?? 'Erro ao emitir fatura. Verifica a ligação à Moloni On.')
        } finally {
            setSaving(false)
        }
    }

    return (
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
                        <a
                            href={`/admin/clients/${reservation.client_id}`}
                            className="text-xs text-blue-500 hover:underline"
                            target="_blank" rel="noopener noreferrer"
                        >
                            ✏️ Editar dados
                        </a>
                    </div>
                    <p className="font-medium">{reservation.client_name}</p>
                    {reservation.client_email && (
                        <p className="text-xs text-gray-500">{reservation.client_email}</p>
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
                            /* Cliente tem NIF guardado */
                            <label className="flex items-center gap-2 cursor-pointer select-none text-xs">
                                <input
                                    type="checkbox"
                                    checked={usarNifCliente}
                                    onChange={e => setUsarNifCliente(e.target.checked)}
                                    className="rounded"
                                />
                                Emitir com NIF do cliente
                                <span className="text-gray-400 font-mono ml-1">({clientNifSaved})</span>
                            </label>
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
                    <p className="text-xs text-gray-500 mb-2 font-medium">Linhas da fatura</p>
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

                    <button
                        type="button"
                        onClick={addLine}
                        className="mt-2 text-xs text-blue-500 hover:underline"
                    >
                        + Adicionar serviço / produto
                    </button>

                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                        <span>Subtotal das linhas:</span>
                        <span className="font-medium text-gray-700">{totalLinhas.toFixed(2)} €</span>
                    </div>
                </div>

                {/* Valor a faturar (editável) */}
                <div>
                    <label className="block text-xs text-gray-500 mb-1">
                        Valor a faturar (€)
                        <span className="ml-1 text-gray-400">— editável para ajustes</span>
                    </label>
                    <input
                        type="number" min={0} step={0.5}
                        className="input text-sm w-full font-semibold"
                        value={valorOverride}
                        onChange={e => { setValorOverride(Number(e.target.value)); setError(null) }}
                    />
                    {Math.abs(valorOverride - totalLinhas) > 0.01 && (
                        <p className="text-[10px] text-amber-600 mt-1">
                            ⚠️ Valor difere do subtotal das linhas ({totalLinhas.toFixed(2)} €).
                        </p>
                    )}
                </div>

                {error && (
                    <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {error}
                    </p>
                )}
            </div>
        </Modal>
    )
}