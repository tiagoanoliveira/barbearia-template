import { useRef, useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import ptLocale from '@fullcalendar/core/locales/pt'
import type { EventClickArg } from '@fullcalendar/core'
import { format } from 'date-fns'

import { reservationsApi } from '@/api/reservations'
import { barbersApi } from '@/api/barbers'
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
  const [selectedDate, setSelectedDate] = useState(() => format(new Date(), 'yyyy-MM-dd'))

  const adminUser = useMemo(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('admin_user')
      return raw ? JSON.parse(raw) as { role?: string; barbeiro_id?: number } : null
    } catch {
      return null
    }
  }, [])

  const barberFilterId = adminUser?.role === 'barbeiro' && adminUser.barbeiro_id ? adminUser.barbeiro_id : null

  const { data: barbersRes } = useQuery({
    queryKey: ['barbers'],
    queryFn: () => barbersApi.list(),
  })

  const { data: resRes, isLoading } = useQuery({
    queryKey: ['reservations-calendar', selectedDate],
    queryFn: () => reservationsApi.list({ date: selectedDate, perPage: 200 }),
  })

  const barbers       = barbersRes?.data ?? []
  const reservations  = resRes?.data?.items ?? []
  const filteredRes   = barberFilterId
    ? reservations.filter(r => r.barber_id === barberFilterId)
    : reservations

  const events = filteredRes.map((r) => {
    const color = (r.barber_color as string | undefined) || statusColors[r.status]
    const durationMinutes = (r.service_duration as number | undefined) ?? 60
    const startDate = new Date(r.data_hora)
    const endDate   = new Date(startDate.getTime() + durationMinutes * 60_000)

    return {
      id: String(r.id),
      title: `${r.client_name} — ${r.service_name}`,
      start: r.data_hora,
      end:   endDate.toISOString(),
      backgroundColor: color,
      borderColor:     color,
      extendedProps: { reservationId: r.id, barberId: r.barber_id },
    }
  })

  const handleEventClick = (arg: EventClickArg) => {
    console.log('Reserva:', arg.event.extendedProps.reservationId)
  }

  const handleDateChange = (value: string) => {
    setSelectedDate(value)
    const api = calRef.current?.getApi()
    if (api && value) {
      api.gotoDate(value)
    }
  }

  if (isLoading) {
    return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
  }

  const barbersForLegend = barberFilterId
    ? barbers.filter(b => b.id === barberFilterId)
    : barbers

  return (
    <div className="space-y-4">
      {/* Filtros e legenda */}
      <Card padding="sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600 text-xs uppercase tracking-wide">Data</span>
            <input
              type="date"
              value={selectedDate}
              onChange={e => handleDateChange(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-800
                         bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {barbersForLegend.map((b) => (
              <div key={b.id} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full" style={{ background: b.color ?? '#d4a017' }} />
                <span className="text-xs text-gray-600">{b.name}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Calendar */}
      <Card padding="md">
        <FullCalendar
          ref={calRef}
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="timeGridDay"
          locale={ptLocale}
          headerToolbar={{
            left: 'prev,next today',
            center: 'title',
            right: '',
          }}
          initialDate={selectedDate}
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
