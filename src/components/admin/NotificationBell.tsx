import { Bell, Check, RotateCcw } from 'lucide-react'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { adminApi } from '@/api/client'
import type { ApiResponse } from '@/types'
import { useAdminUser } from '@/hooks/useAdminUser'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NotificationDto {
  id: number
  type: string
  message: string
  reservation_id?: number | null
  reservation_date?: string | null
  client_name?: string | null
  barber_id?: number | null
  barber_name?: string | null
  barber_color?: string | null
  is_read: number
  created_at: string
}

interface NotificationsResponse extends ApiResponse<NotificationDto[]> {}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNotifIcon(type: string): string {
  const t = (type ?? '').toLowerCase()
  if (t.includes('cancel'))                       return '❌'
  if (t.includes('edit') || t.includes('alter'))  return '✏️'
  if (t.includes('nova') || t.includes('new') || t.includes('booking')) return '📅'
  return '🔔'
}

function isoToLocalDateStr(iso: string): string {
  return iso.slice(0, 10)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

const SEEN_IDS_KEY = 'notif_seen_ids'

function loadSeenIds(): Set<number> {
  try {
    const raw = sessionStorage.getItem(SEEN_IDS_KEY)
    if (!raw) return new Set()
    return new Set(JSON.parse(raw) as number[])
  } catch { return new Set() }
}

function saveSeenIds(ids: Set<number>) {
  try {
    sessionStorage.setItem(SEEN_IDS_KEY, JSON.stringify([...ids]))
  } catch {}
}

function useAdminNotifications() {
  const adminUser = useAdminUser()
  const isBarber  = adminUser?.role === 'barbeiro'
  const barberId  = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : undefined

  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  const [unreadList, setUnreadList]       = useState<NotificationDto[]>([])
  const [toasts, setToasts]               = useState<NotificationDto[]>([])

  const lastFetchAtRef = useRef<string | null>(null)
  // Carrega os IDs vistos da sessionStorage para sobreviver ao refresh
  const lastSeenIdsRef = useRef<Set<number>>(loadSeenIds())
  const isFirstFetchRef = useRef(true)

  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null)
  useEffect(() => {
    if (typeof window === 'undefined') return
    audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
    return () => { audioCtxRef.current?.close().catch(() => {}) }
  }, [])

  const playCashRegisterSound = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx) return
    const t = ctx.currentTime
    const beep = (time: number, freq: number, dur: number, type: OscillatorType = 'square') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, time)
      gain.gain.setValueAtTime(0.0001, time)
      gain.gain.exponentialRampToValueAtTime(0.4, time + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, time + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(time)
      osc.stop(time + dur + 0.02)
    }
    beep(t + 0.00, 880, 0.08)
    beep(t + 0.09, 660, 0.08)
    beep(t + 0.18, 990, 0.12, 'sawtooth')
  }, [])

  // Polling — apenas não lidas
  const fetchUnread = useCallback(async () => {
    const params = new URLSearchParams()
    params.set('unread', 'true')
    if (lastFetchAtRef.current) params.set('since', lastFetchAtRef.current)
    if (barberId) params.set('barber_id', String(barberId))

    const res = await adminApi.get<NotificationDto[]>(
        `/api/admin/notifications?${params}`
    ) as NotificationsResponse
    if (!res.success || !Array.isArray(res.data)) return

    const data = res.data
    lastFetchAtRef.current = new Date().toISOString()

    const currentIds = new Set(data.map(n => n.id))

    if (isFirstFetchRef.current) {
      isFirstFetchRef.current = false
      lastSeenIdsRef.current = currentIds
      saveSeenIds(currentIds)
      setUnreadList(data)
      return
    }

    const newIds = [...currentIds].filter(id => !lastSeenIdsRef.current.has(id))

    if (newIds.length > 0) {
      const newItems = data.filter(n => newIds.includes(n.id))
      setToasts(prev => {
        const existing = new Set(prev.map(t => t.id))
        return [...prev, ...newItems.filter(n => !existing.has(n.id))]
      })
      playCashRegisterSound()
      lastSeenIdsRef.current = currentIds
      saveSeenIds(currentIds)
    } else if (data.length === 0) {
      lastSeenIdsRef.current = new Set()
      saveSeenIds(new Set())
    }

    setUnreadList(data)
    setNotifications(prev =>
        prev.map(n => {
          const updated = data.find(u => u.id === n.id)
          return updated ? { ...n, is_read: 0 } : n
        })
    )
  }, [barberId, playCashRegisterSound])

  const fetchPanel = useCallback(async () => {
    const params = new URLSearchParams()
    if (barberId) params.set('barber_id', String(barberId))
    const res = await adminApi.get<NotificationDto[]>(
        `/api/admin/notifications?${params}`
    ) as NotificationsResponse
    if (!res.success || !Array.isArray(res.data)) return
    setNotifications(res.data)
  }, [barberId])

  // Arranque + polling de 30s
  useEffect(() => {
    fetchUnread().catch(() => {})
    const interval = setInterval(() => fetchUnread().catch(() => {}), 30000)
    return () => clearInterval(interval)
  }, [fetchUnread])

  // Auto-dismiss de cada toast ao fim de 10s (por ordem de chegada)
  useEffect(() => {
    if (toasts.length === 0) return
    const oldest = toasts[0]
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== oldest.id))
    }, 10000)
    return () => clearTimeout(timer)
  }, [toasts])

  const unreadCount = unreadList.length

  const markAsRead = useCallback(async (id: number | null) => {
    try {
      if (id !== null) {
        await adminApi.patch('/api/admin/notifications', { id })
        setUnreadList(prev => prev.filter(n => n.id !== id))
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n))
        // Remover dos seenIds para que se reaparecer seja tratado como novo
        lastSeenIdsRef.current.delete(id)
        saveSeenIds(lastSeenIdsRef.current)
      } else {
        await adminApi.patch('/api/admin/notifications', {})
        setUnreadList([])
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
        lastSeenIdsRef.current = new Set()
        saveSeenIds(new Set())
      }
    } catch { /* silencioso */ }
  }, [])

  const markAsUnread = useCallback(async (id: number) => {
    try {
      await adminApi.patch('/api/admin/notifications', { id, unread: true })
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: 0 } : n))
      await fetchUnread()
    } catch { /* silencioso */ }
  }, [fetchUnread])

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return {
    notifications,
    unreadCount,
    toasts,
    dismissToast,
    fetchPanel,
    markAsRead,
    markAsUnread,
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const navigate = useNavigate()
  const {
    notifications,
    unreadCount,
    toasts,
    dismissToast,
    fetchPanel,
    markAsRead,
    markAsUnread,
  } = useAdminNotifications()

  const [open, setOpen] = useState(false)

  const handleOpenToggle = () => {
    const next = !open
    setOpen(next)
    if (next) fetchPanel().catch(() => {})
  }

  const navigateToReservation = (n: NotificationDto) => {
    if (!n.reservation_id) return
    const dateStr = n.reservation_date
        ? isoToLocalDateStr(n.reservation_date)
        : isoToLocalDateStr(n.created_at)
    navigate(`/admin/calendario?date=${dateStr}&reservationId=${n.reservation_id}`)
  }

  const handleClickNotification = async (n: NotificationDto) => {
    if (!n.is_read) await markAsRead(n.id)
    setOpen(false)
    navigateToReservation(n)
  }

  const handleToastClick = async (t: NotificationDto) => {
    dismissToast(t.id)
    await markAsRead(t.id)
    navigateToReservation(t)
  }

  return (
      <div className="relative flex items-center">

        {/* ── Stack de toasts — canto superior direito, cresce para baixo ── */}
        <div className="hidden sm:flex flex-col gap-2 fixed top-16 right-4 z-50 items-end pointer-events-none">
          {toasts.map(t => (
              <div
                  key={t.id}
                  className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl border border-gray-200 w-80 max-w-[90vw]"
                  style={{ animation: 'notifSlideIn 0.25s ease-out' }}
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{getNotifIcon(t.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-gray-900 leading-snug line-clamp-2">
                    {t.message}
                  </p>
                  {t.client_name && (
                      <p className="text-[11px] text-gray-400 mt-0.5">{t.client_name}</p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0 ml-1">
                  {t.reservation_id && (
                      <button
                          className="text-xs text-brand-600 hover:underline whitespace-nowrap font-medium"
                          onClick={() => handleToastClick(t)}
                      >
                        Ver reserva
                      </button>
                  )}
                  <button
                      className="text-[11px] text-gray-400 hover:text-gray-600"
                      onClick={() => dismissToast(t.id)}
                  >
                    Fechar
                  </button>
                </div>
              </div>
          ))}
        </div>

        {/* ── Animação (injectada inline para não depender de tailwind.config) ── */}
        <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

        {/* ── Sino ── */}
        <button
            type="button"
            className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
            onClick={handleOpenToggle}
            aria-label="Notificações"
        >
          <Bell size={18} className="text-gray-700" />
          {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-[10px] leading-4 text-white text-center font-semibold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
          )}
        </button>

        {/* ── Dropdown ── */}
        {open && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-40 text-xs overflow-hidden">

                <div className="px-3 py-2.5 border-b border-gray-100 flex items-center justify-between">
                  <span className="font-semibold text-gray-800 text-[13px]">Notificações</span>
                  {notifications.some(n => !n.is_read) && (
                      <button
                          className="text-[11px] text-brand-600 hover:underline"
                          onClick={() => markAsRead(null)}
                      >
                        Marcar todas como lidas
                      </button>
                  )}
                </div>

                <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                  {notifications.length === 0 ? (
                      <p className="px-3 py-5 text-gray-400 text-[11px] text-center">
                        Sem notificações recentes.
                      </p>
                  ) : (
                      notifications.map(n => {
                        const isUnread = !n.is_read
                        const created  = n.created_at ? new Date(n.created_at) : null
                        const dateStr  = created
                            ? created.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
                            : ''
                        const timeStr  = created
                            ? created.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
                            : ''

                        return (
                            <div
                                key={n.id}
                                className={`flex items-start gap-2 px-3 py-2.5 transition-colors ${
                                    isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'
                                }`}
                            >
                      <span className="text-base flex-shrink-0 mt-0.5 select-none">
                        {getNotifIcon(n.type)}
                      </span>

                              <button
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => handleClickNotification(n)}
                              >
                                <p className={`text-[11px] leading-snug line-clamp-2 ${
                                    isUnread ? 'text-gray-900 font-medium' : 'text-gray-500'
                                }`}>
                                  {n.message}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">
                                  {dateStr && timeStr ? `${dateStr} · ${timeStr}` : ''}
                                  {n.client_name ? ` · ${n.client_name}` : ''}
                                  {n.is_read ? ' · lida' : ''}
                                </p>
                              </button>

                              <button
                                  title={isUnread ? 'Marcar como lida' : 'Marcar como não lida'}
                                  className={`flex-shrink-0 mt-0.5 w-6 h-6 flex items-center justify-center rounded-full border transition-all ${
                                      isUnread
                                          ? 'border-gray-300 text-gray-300 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50'
                                          : 'border-emerald-400 text-emerald-500 bg-emerald-50 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50'
                                  }`}
                                  onClick={e => {
                                    e.stopPropagation()
                                    isUnread ? markAsRead(n.id) : markAsUnread(n.id)
                                  }}
                              >
                                {isUnread ? <Check size={11} /> : <RotateCcw size={11} />}
                              </button>
                            </div>
                        )
                      })
                  )}
                </div>
              </div>
            </>
        )}
      </div>
  )
}