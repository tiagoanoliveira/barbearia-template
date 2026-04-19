import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'

import Modal from '@/components/ui/Modal'

export interface UnavailabilityConflictReservation {
  id: number
  client_name: string
  service_name: string
  data_hora: string
  duration_minutes: number
}

export function UnavailabilityConflictsModal({
  open,
  reservations,
  saving = false,
  onCancel,
  onConfirm,
}: {
  open: boolean
  reservations: UnavailabilityConflictReservation[]
  saving?: boolean
  onCancel: () => void
  onConfirm: (payload: { selectedIds: number[]; reason: string }) => Promise<void> | void
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSelected(new Set(reservations.map(r => r.id)))
    setReason('')
    setError(null)
  }, [open, reservations])

  const allSelected = useMemo(
    () => reservations.length > 0 && reservations.every(r => selected.has(r.id)),
    [reservations, selected]
  )
  const hasSelectedReservations = selected.size > 0

  const toggleOne = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(reservations.map(r => r.id)))
  }

  const handleConfirm = async () => {
    const ids = reservations.filter(r => selected.has(r.id)).map(r => r.id)
    if (ids.length > 0 && !reason.trim()) {
      setError('O motivo de cancelamento é obrigatório.')
      return
    }
    setError(null)
    await onConfirm({ selectedIds: ids, reason: reason.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="⚠️ Reservas com conflitos"
      size="xl"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel}>Cancelar operação</button>
          <button className="btn-primary" onClick={() => { void handleConfirm() }} disabled={saving}>
            {saving ? 'A confirmar...' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
          <p className="font-semibold flex items-center gap-2">
            <AlertTriangle size={16} />
            Existem reservas confirmadas no horário selecionado.
          </p>
          <p className="mt-1">Selecione quais reservas deseja cancelar.</p>
        </div>

        <button
          type="button"
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-primary-500 text-white text-sm font-medium hover:bg-primary-600"
          onClick={toggleAll}
        >
          <CheckSquare size={16} />
          {allSelected ? 'Desselecionar todas' : 'Selecionar todas'}
        </button>

        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
          {reservations.map(r => (
            <label key={r.id} className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selected.has(r.id)}
                onChange={() => toggleOne(r.id)}
                className="mt-1 h-5 w-5"
              />
              <div>
                <p className="font-semibold text-gray-900">{r.client_name}</p>
                <p className="text-sm text-gray-600 flex items-center gap-1">
                  <CalendarDays size={14} />
                  {format(new Date(r.data_hora), "dd/MM/yyyy 'às' HH:mm")} | {r.service_name}
                </p>
              </div>
            </label>
          ))}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Motivo do cancelamento {hasSelectedReservations ? '*' : ''}
          </label>
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Ex: Por motivos pessoais o barbeiro não pode comparecer."
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">Este comentário será enviado por email aos clientes das reservas canceladas.</p>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
