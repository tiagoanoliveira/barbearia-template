import type { ReservationStatus } from '@/types'

const statusConfig: Record<ReservationStatus, { label: string; className: string }> = {
  pendente:   { label: 'Pendente',   className: 'badge-pending' },
  confirmada: { label: 'Confirmada', className: 'badge-confirmed' },
  concluida:  { label: 'Concluída',  className: 'badge-completed' },
  cancelada:  { label: 'Cancelada',  className: 'badge-cancelled' },
  faltou:     { label: 'Não veio',   className: 'badge-no_show' },
}

interface StatusBadgeProps {
  status: ReservationStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = statusConfig[status] ?? statusConfig.pendente
  return <span className={className}>{label}</span>
}
