import { useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptLocale from '@fullcalendar/core/locales/pt'
import type { EventClickArg } from '@fullcalendar/core'

import { reservationsApi } from '@/api/reservations'
import { Card } from '@/components/ui/Card'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { ReservationStatus } from '@/types'

const statusColors: Record<ReservationStatus, string> = {
  pendente:   '#f59e0b',
  confirmada: '#3b82f6',
  concluida:  '#10b981',
  cancelada:  '#ef4444',
  faltou:     '#6b7280',
}

export default function CalendarPage() {
  const calRef = useRef<FullCalendar>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['reservations-all'],
    queryFn: () => reservationsApi.list({ perPage: 200 }),
  })

  const reservations = data?.data?.items ?? []

  const events = reservations.map((r) => ({
    id: String(r.id),
    title: `${r.client_name} — ${r.service_name}`,
    start: r.data_hora,
    end: new Date(
      new Date(r.data_hora).getTime() + r.service_duration * 60_000
    ).toISOString(),
    backgroundColor: statusColors[r.status],
    borderColor: statusColors[r.status],
    extendedProps: { reservationId: r.id },
  }))

  const handleEventClick = (arg: EventClickArg) => {
    console.log('Reserva:', arg.event.extendedProps.reservationId)
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Legenda */}
      <Card padding="sm">
        <div className="flex flex-wrap items-center gap-4">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: color }} />
              <span className="text-xs text-gray-600 capitalize">
                {status === 'faltou'    ? 'Não veio' :
                 status === 'pendente'  ? 'Pendente' :
                 status === 'confirmada'? 'Confirmada' :
                 status === 'concluida' ? 'Concluída' : 'Cancelada'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Calendar */}
      <Card padding="md">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          locale={ptLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay',
          }}
          events={events}
          eventClick={handleEventClick}
          selectable
          slotMinTime="08:00:00"
          slotMaxTime="21:00:00"
          allDaySlot={false}
          height="auto"
          eventDisplay="block"
          slotLabelFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
          eventTimeFormat={{ hour: '2-digit', minute: '2-digit', hour12: false }}
        />
      </Card>
    </div>
  )
}
