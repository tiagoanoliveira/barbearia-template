import { Bell } from 'lucide-react'
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/api/client'
import type { ApiResponse } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'

interface NotificationDto {
  id: number
  type: string
  message: string
  reservation_id?: number | null
  client_name?: string | null
  barber_id?: number | null
  barber_name?: string | null
  barber_color?: string | null
  is_read: number
  created_at: string
}

interface NotificationsResponse extends ApiResponse<NotificationDto[]> {}

function useAdminNotifications() {
  const adminUser = useAdminUser()
  const isBarber  = adminUser?.role === 'barbeiro'
  const barberId  = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : undefined

  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [lastFetchAt, setLastFetchAt]     = useState<string | null>(null)
  const [lastSeenIds, setLastSeenIds]     = useState<Set<number>>(new Set())
  const [newPopup, setNewPopup]           = useState<NotificationDto | null>(null)

  // Carregar som apenas no browser
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    setAudioCtx(ctx)
    return () => {
      ctx.close().catch(() => {})
    }
  }, [])

  const playCashRegisterSound = () => {
    if (!audioCtx) return
    const ctx    = audioCtx
    const startT = ctx.currentTime

    const beep = (time: number, freq: number, duration: number, type: OscillatorType = 'square') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, time)
      gain.gain.setValueAtTime(0.0001, time)
      gain.gain.exponentialRampToValueAtTime(0.4, time + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(time)
      osc.stop(time + duration + 0.02)
    }

    // Pequena sequência "caixa registadora"
    beep(startT + 0.0, 880, 0.08)
    beep(startT + 0.09, 660, 0.08)
    beep(startT + 0.18, 990, 0.12, 'sawtooth')
  }

  const fetchNotifications = async () => {
    const params = new URLSearchParams()
    params.set('unread', 'true')
    if (lastFetchAt) params.set('since', lastFetchAt)
    if (barberId) params.set('barber_id', String(barberId))

    const res = await adminApi.get<NotificationDto[]>(`/api/admin/notifications?${params.toString()}`) as NotificationsResponse
    if (!res.success || !Array.isArray(res.data)) return

    const data = res.data
    setNotifications(prev => {
      // manter lista de não lidas actualizada
      const merged = [...data]
      return merged
    })

    const nowIso = new Date().toISOString()
    setLastFetchAt(nowIso)

    // Detectar novas notificações desde o último poll
    const currentIds = new Set(data.map(n => n.id))
    const newIds: number[] = []
    currentIds.forEach(id => {
      if (!lastSeenIds.has(id)) newIds.push(id)
    })

    if (newIds.length > 0) {
      const newest = data.find(n => n.id === newIds[0]) ?? data[0]
      if (newest) {
        setNewPopup(newest)
        playCashRegisterSound()
      }
      setLastSeenIds(currentIds)
    } else if (data.length === 0) {
      setLastSeenIds(new Set())
      setNewPopup(null)
    }
  }

  useEffect(() => {
    fetchNotifications().catch(() => {})
    const interval = setInterval(() => {
      fetchNotifications().catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [barberId])

  const unreadCount = useMemo(() => notifications.filter(n => !n.is_read).length, [notifications])

  const markAsRead = async (id: number | null) => {
    try {
      if (id) {
        await adminApi.patch('/api/admin/notifications', { id })
        setNotifications(prev => prev.filter(n => n.id !== id))
      } else {
        await adminApi.patch('/api/admin/notifications', {})
        setNotifications([])
      }
    } catch {
      // silencioso
    }
  }

  return { notifications, unreadCount, newPopup, setNewPopup, markAsRead }
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { notifications, unreadCount, newPopup, setNewPopup, markAsRead } = useAdminNotifications()
  const [open, setOpen] = useState(false)

  const handleClickNotification = async (n: NotificationDto) => {
    await markAsRead(n.id)
    setOpen(false)
    setNewPopup(null)
    if (n.reservation_id) {
      const created = n.created_at ? new Date(n.created_at) : new Date()
      const dateStr = created.toISOString().slice(0, 10)
      navigate(`/admin/calendario?date=${dateStr}&reservationId=${n.reservation_id}`)
    }
  }

  return (
    <div className="relative flex items-center gap-3">
      {/* Popup para nova notificação */}
      {newPopup && (
        <div className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-lg border border-gray-200 text-xs text-gray-800 absolute -bottom-14 left-0 z-40">
          <span className="text-yellow-500">⚡</span>
          <button
            className="text-left truncate max-w-[220px] hover:underline"
            onClick={() => handleClickNotification(newPopup)}
          >
            {newPopup.message}
          </button>
          <button
            className="text-[10px] text-gray-400 ml-2 hover:text-gray-600"
            onClick={() => setNewPopup(null)}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Sino principal */}
      <button
        type="button"
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        onClick={() => setOpen(o => !o)}
        aria-label="Notificações"
      >
        <Bell size={18} className="text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-9 mt-1 w-72 bg-white border border-gray-200 rounded-xl shadow-xl z-40 text-xs">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
            <span className="font-semibold text-gray-800">Notificações</span>
            {unreadCount > 0 && (
              <button
                className="text-[10px] text-brand-600 hover:underline"
                onClick={() => markAsRead(null)}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-4 text-gray-400 text-[11px]">Sem notificações por ler.</p>
            ) : (
              notifications.map(n => {
                const created = n.created_at ? new Date(n.created_at) : null
                const dateStr = created ? created.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' }) : ''
                const timeStr = created ? created.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : ''
                return (
                  <button
                    key={n.id}
                    className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-start gap-2 border-b border-gray-50 last:border-b-0"
                    onClick={() => handleClickNotification(n)}
                  >
                    <div className="mt-0.5 flex-shrink-0 w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-gray-800 leading-snug truncate">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {dateStr && timeStr ? `${dateStr} · ${timeStr}` : ''}
                        {n.client_name ? ` · ${n.client_name}` : ''}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
