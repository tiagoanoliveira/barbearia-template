import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import Modal from '@/components/ui/Modal'

export interface UnavailabilityConflictReservation {
  id: number
  client_name: string
  service_name: string
  data_hora: string
}

export function UnavailabilityConflictsModal({
  open,
  reservations,
  onCancel,
  onConfirm,
  saving = false,
}: {
  open: boolean
  reservations: UnavailabilityConflictReservation[]
  onCancel: () => void
  onConfirm: (payload: { selectedIds: number[]; reason: string }) => void
  saving?: boolean
}) {
  const allIds = useMemo(() => reservations.map(r => r.id), [reservations])
  const [selectedIds, setSelectedIds] = useState<number[]>(allIds)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setSelectedIds(allIds)
      setReason('')
      setError(null)
    }
  }, [open, allIds])

  const toggle = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }
  const allSelected = reservations.length > 0 && selectedIds.length === reservations.length

  const handleConfirm = () => {
    if (selectedIds.length === 0) {
      setError('Selecione pelo menos uma reserva para cancelar.')
      return
    }
    if (!reason.trim()) {
      setError('O motivo do cancelamento é obrigatório.')
      return
    }
    onConfirm({ selectedIds, reason: reason.trim() })
  }

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="⚠️ Reservas com conflitos"
      footer={
        <>
          <button className="btn-secondary" onClick={onCancel} disabled={saving}>Cancelar Operação</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'A processar...' : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          Existem reservas confirmadas no período selecionado. Selecione as reservas a cancelar.
        </div>

        <button
          type="button"
          className="btn-primary text-xs"
          onClick={() => setSelectedIds(allSelected ? [] : allIds)}
          disabled={saving}
        >
          {allSelected ? 'Desmarcar todas' : 'Selecionar todas'}
        </button>

        <div className="border border-gray-200 rounded-xl max-h-72 overflow-y-auto divide-y divide-gray-100">
          {reservations.map(r => (
            <label key={r.id} className="flex items-start gap-3 px-3 py-2.5 cursor-pointer hover:bg-gray-50">
              <input
                type="checkbox"
                checked={selectedIds.includes(r.id)}
                onChange={() => { toggle(r.id); setError(null) }}
                disabled={saving}
                className="mt-1"
              />
              <span>
                <strong className="block text-gray-900">{r.client_name}</strong>
                <span className="text-gray-600">
                  {format(parseISO(r.data_hora), "dd/MM/yyyy 'às' HH:mm", { locale: pt })} | {r.service_name}
                </span>
              </span>
            </label>
          ))}
        </div>

        <div>
          <label htmlFor="unavailability-cancel-reason" className="block text-xs text-gray-600 mb-1.5 font-medium">Motivo do Cancelamento <span className="text-red-500">*</span></label>
          <textarea
            id="unavailability-cancel-reason"
            rows={3}
            className={`input text-sm w-full resize-none ${error ? 'border-red-400' : ''}`}
            value={reason}
            onChange={e => { setReason(e.target.value); setError(null) }}
            placeholder="Este motivo será enviado por email aos clientes das reservas canceladas."
            disabled={saving}
          />
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
    </Modal>
  )
}
