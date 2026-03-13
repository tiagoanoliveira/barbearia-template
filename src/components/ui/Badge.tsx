import type { ReservationStatus } from '@/types'

const statusConfig: Record<ReservationStatus, { label: string; className: string }> = {
  pending:   { label: 'Pendente',   className: 'badge-pending' },
  confirmed: { label: 'Confirmada', className: 'badge-confirmed' },
  completed: { label: 'Concluída',  className: 'badge-completed' },
  cancelled: { label: 'Cancelada',  className: 'badge-cancelled' },
  no_show:   { label: 'Não veio',   className: 'badge-no_show' },
}

interface StatusBadgeProps {
  status: ReservationStatus
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label, className } = statusConfig[status] ?? statusConfig.pending
  return <span className={className}>{label}</span>
}
