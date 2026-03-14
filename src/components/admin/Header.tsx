import { useState, useRef, useEffect } from 'react'
import { Bell, Menu, X, Calendar, Users } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { pt } from 'date-fns/locale'
import { barberShopConfig } from '@/config/theme'
import { reservationsApi } from '@/api/reservations'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
}

export default function Header({ title, subtitle, onMenuToggle }: HeaderProps) {
  const user = JSON.parse(localStorage.getItem('admin_user') ?? '{}')
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  const [notifOpen, setNotifOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fechar ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node))
        setNotifOpen(false)
    }
    if (notifOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notifOpen])

  const today = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(new Date(Date.now() + 86400000), 'yyyy-MM-dd')

  const { data: todayRes } = useQuery({
    queryKey: ['notif-today'],
    queryFn:  () => reservationsApi.list({ date: today, perPage: 50 }),
    enabled: notifOpen,
  })
  const { data: tomorrowRes } = useQuery({
    queryKey: ['notif-tomorrow'],
    queryFn:  () => reservationsApi.list({ date: tomorrow, perPage: 50 }),
    enabled: notifOpen,
  })

  const todayItems    = (todayRes?.data?.items   ?? []).filter((r: any) => r.status !== 'cancelada')
  const tomorrowItems = (tomorrowRes?.data?.items ?? []).filter((r: any) => r.status !== 'cancelada')
  const total = todayItems.length + tomorrowItems.length

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between
                 bg-white border-b border-gray-100 px-6"
      style={{ left: 'var(--sidebar-width)', height: 'var(--header-height)' }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button onClick={onMenuToggle} className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Menu size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3" ref={panelRef}>
        {/* Notificações */}
        <div className="relative">
          <button
            onClick={() => setNotifOpen(o => !o)}
            className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors"
          >
            <Bell size={20} className="text-gray-600" />
            {total > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-brand-500 rounded-full
                               text-white text-[9px] font-bold flex items-center justify-center px-0.5">
                {total > 99 ? '99+' : total}
              </span>
            )}
          </button>

          {/* Painel de notificações */}
          {notifOpen && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">Próximas reservas</p>
                <button onClick={() => setNotifOpen(false)} className="p-1 rounded-lg hover:bg-gray-100">
                  <X size={14} className="text-gray-500" />
                </button>
              </div>

              <div className="max-h-96 overflow-y-auto">
                {todayItems.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-[10px] uppercase font-semibold text-gray-400 tracking-wide bg-gray-50">
                      Hoje · {todayItems.length} reservas
                    </p>
                    {todayItems.map((r: any) => (
                      <NotifItem key={r.id} r={r} />
                    ))}
                  </div>
                )}
                {tomorrowItems.length > 0 && (
                  <div>
                    <p className="px-4 py-2 text-[10px] uppercase font-semibold text-gray-400 tracking-wide bg-gray-50">
                      Amanhã · {tomorrowItems.length} reservas
                    </p>
                    {tomorrowItems.map((r: any) => (
                      <NotifItem key={r.id} r={r} />
                    ))}
                  </div>
                )}
                {todayItems.length === 0 && tomorrowItems.length === 0 && (
                  <div className="px-4 py-8 text-center">
                    <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-sm text-gray-500">Sem reservas para hoje ou amanhã</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">{user?.name ?? 'Admin'}</p>
            <p className="text-xs text-gray-500">{barberShopConfig.name}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

function NotifItem({ r }: { r: any }) {
  const dt = new Date(r.data_hora)
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors border-b border-gray-50">
      <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
        <Users size={14} className="text-brand-600" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-gray-900 truncate">{r.client_name}</p>
        <p className="text-[10px] text-gray-500 truncate">{r.service_name} · {r.barber_name}</p>
        <p className="text-[10px] text-brand-600 font-medium">{format(dt, 'HH:mm')}</p>
      </div>
    </div>
  )
}
