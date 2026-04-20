import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { AlertTriangle, CalendarDays } from 'lucide-react'
import Modal from '@/components/ui/Modal'
import type { ConflictReservation } from '@/types'

export interface ConflictReservationsModalProps {
  open: boolean
  reservations: ConflictReservation[]
  saving?: boolean
  onCancel: () => void
  onConfirm: (selectedIds: number[], reason: string) => void
}

export function ConflictReservationsModal({
  open,
  reservations,
  saving,
  onCancel,
  onConfirm,
}: ConflictReservationsModalProps) {
  const [selected, setSelected]   = useState<Set<number>>(() => new Set(reservations.map(r => r.id)))
  const [reason,   setReason]     = useState('')
  const [error,    setError]      = useState<string | null>(null)

  const allSelected = reservations.length > 0 && selected.size === reservations.length

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set())
    } else {
      setSelected(new Set(reservations.map(r => r.id)))
    }
  }

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleConfirm = () => {
    if (selected.size > 0 && !reason.trim()) {
      setError('O motivo de cancelamento é obrigatório.')
      return
    }
    setError(null)
    onConfirm(Array.from(selected), reason.trim())
  }

  const fmtDateTime = (iso: string) => {
    try {
      return format(parseISO(iso), "dd/MM/yyyy 'às' HH:mm", { locale: pt })
    } catch {
      return iso
    }
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="⚠️ Reservas com conflitos"
      size="md"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>
            Cancelar Operação
          </button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'A guardar...' : '✓ Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Warning banner */}
        <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 text-yellow-800">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-500" />
          <p>
            Existem reservas confirmadas no horário selecionado.
            Selecione quais reservas deseja cancelar:
          </p>
        </div>

        {/* Select all */}
        <button
          type="button"
          onClick={toggleAll}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white text-sm"
          style={{ background: '#1a5c3a' }}
        >
          <span
            className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
              allSelected ? 'bg-white border-white' : 'border-white'
            }`}
          >
            {allSelected && <span className="text-green-800 text-xs font-bold leading-none">✓</span>}
          </span>
          Selecionar Todas
        </button>

        {/* Reservation list */}
        <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
          {reservations.map(r => (
            <label
              key={r.id}
              className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <input
                type="checkbox"
                className="mt-0.5 shrink-0 accent-blue-600"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
              />
              <div>
                <p className="font-semibold text-gray-900">{r.client_name}</p>
                <p className="flex items-center gap-1 text-gray-500 text-xs mt-0.5">
                  <CalendarDays size={12} className="shrink-0" />
                  {fmtDateTime(r.data_hora)} | {r.service_name}
                </p>
              </div>
            </label>
          ))}
        </div>

        {/* Cancellation reason */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo do Cancelamento <span className="text-red-500">*</span>
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={e => { setReason(e.target.value); setError(null) }}
            placeholder="Ex: Por motivos pessoais o barbeiro não pode comparecer. Por esse motivo, a sua reserva foi cancelada."
            className={`input text-sm w-full resize-none ${error ? 'border-red-400' : ''}`}
            disabled={selected.size === 0}
          />
          {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
          <p className="flex items-center gap-1 text-xs text-yellow-700 mt-1.5">
            <AlertTriangle size={12} className="shrink-0" />
            Este comentário será enviado por email aos clientes das reservas canceladas.
          </p>
        </div>
      </div>
    </Modal>
  )
}
