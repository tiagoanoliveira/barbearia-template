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
  if (t.includes('cancel'))                      return '❌'
  if (t.includes('edit') || t.includes('alter')) return '✏️'
  if (t.includes('nova') || t.includes('new'))   return '📅'
  return '🔔'
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

function useAdminNotifications() {
  const adminUser = useAdminUser()
  const isBarber  = adminUser?.role === 'barbeiro'
  const barberId  = isBarber && adminUser?.barbeiro_id ? adminUser.barbeiro_id : undefined

  // Lista completa para o painel (não lidas 7d + lidas 24h)
  const [notifications, setNotifications] = useState<NotificationDto[]>([])
  // Lista apenas das não lidas para o badge e polling
  const [unreadList, setUnreadList]       = useState<NotificationDto[]>([])
  // Toasts visíveis
  const [toasts, setToasts]               = useState<NotificationDto[]>([])

  const lastFetchAtRef = useRef<string | null>(null)
  const lastSeenIdsRef = useRef<Set<number>>(new Set())

  // Audio context
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

  // Polling: busca apenas não lidas (eficiente, com `since`)
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

    // Detectar IDs novos
    const currentIds = new Set(data.map(n => n.id))
    const newIds = [...currentIds].filter(id => !lastSeenIdsRef.current.has(id))

    if (newIds.length > 0) {
      // Adicionar novos toasts
      const newItems = data.filter(n => newIds.includes(n.id))
      setToasts(prev => {
        const existing = new Set(prev.map(t => t.id))
        return [...prev, ...newItems.filter(n => !existing.has(n.id))]
      })
      playCashRegisterSound()
      lastSeenIdsRef.current = currentIds
    } else if (data.length === 0) {
      lastSeenIdsRef.current = new Set()
    }

    setUnreadList(data)
    // Sincronizar estado `is_read` na lista do painel se já estiver aberta
    setNotifications(prev =>
        prev.map(n => {
          const updated = data.find(u => u.id === n.id)
          return updated ? { ...n, is_read: 0 } : n
        })
    )
  }, [barberId, playCashRegisterSound])

  // Fetch completo para o painel (não lidas 7d + lidas 24h)
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

  // Auto-dismiss de cada toast ao fim de 10s
  useEffect(() => {
    if (toasts.length === 0) return
    const newest = toasts[toasts.length - 1]
    const timer = setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newest.id))
    }, 10000)
    return () => clearTimeout(timer)
  }, [toasts])

  const unreadCount = unreadList.length

  const markAsRead = useCallback(async (id: number | null) => {
    try {
      if (id !== null) {
        await adminApi.patch('/api/admin/notifications', { id })
        setUnreadList(prev => prev.filter(n => n.id !== id))
        setNotifications(prev =>
            prev.map(n => (n.id === id ? { ...n, is_read: 1 } : n))
        )
      } else {
        await adminApi.patch('/api/admin/notifications', {})
        setUnreadList([])
        setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })))
      }
    } catch { /* silencioso */ }
  }, [])

  const markAsUnread = useCallback(async (id: number) => {
    try {
      await adminApi.patch('/api/admin/notifications', { id, unread: true })
      // Optimistic update — o backend precisa de suportar `unread: true` (ver abaixo)
      setNotifications(prev =>
          prev.map(n => (n.id === id ? { ...n, is_read: 0 } : n))
      )
      // Recarrega a lista de não lidas
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

  const handleClickNotification = async (n: NotificationDto) => {
    if (!n.is_read) await markAsRead(n.id)
    setOpen(false)
    if (n.reservation_id) {
      const dateStr = n.reservation_date
          ? new Date(n.reservation_date).toISOString().slice(0, 10)
          : n.created_at
              ? new Date(n.created_at).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10)
      navigate(`/admin/calendario?date=${dateStr}&reservationId=${n.reservation_id}`)
    }
  }

  const handleToastClick = async (t: NotificationDto) => {
    dismissToast(t.id)
    await markAsRead(t.id)
    if (t.reservation_id) {
      const dateStr = t.reservation_date
          ? new Date(t.reservation_date).toISOString().slice(0, 10)
          : t.created_at
              ? new Date(t.created_at).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10)
      navigate(`/admin/calendario?date=${dateStr}&reservationId=${t.reservation_id}`)
    }
  }

  return (
      <div className="relative flex items-center">

        {/* ── Stack de toasts (canto inferior direito, lista de cima para baixo) ── */}
        <div className="hidden sm:flex flex-col gap-2 fixed bottom-5 right-5 z-50 items-end pointer-events-none">
          {toasts.map(t => (
              <div
                  key={t.id}
                  className="pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-xl bg-white shadow-2xl border border-gray-200 w-80 max-w-[90vw] animate-[slideIn_0.25s_ease-out]"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{getNotifIcon(t.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 leading-snug line-clamp-2">
                    {t.message}
                  </p>
                  {t.client_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{t.client_name}</p>
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
              {/* Overlay para fechar ao clicar fora */}
              <div
                  className="fixed inset-0 z-30"
                  onClick={() => setOpen(false)}
              />
              <div className="absolute right-0 top-10 w-80 bg-white border border-gray-200 rounded-xl shadow-xl z-40 text-xs overflow-hidden">

                {/* Cabeçalho */}
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

                {/* Lista */}
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
                                className={`flex items-start gap-2 px-3 py-2.5 group transition-colors ${
                                    isUnread ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'
                                }`}
                            >
                              {/* Ícone de tipo */}
                              <span className="text-base flex-shrink-0 mt-0.5 select-none">
                        {getNotifIcon(n.type)}
                      </span>

                              {/* Texto — clicável para navegar */}
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

                              {/* Botão toggle lida / não lida */}
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
                                {isUnread
                                    ? <Check size={11} />
                                    : <RotateCcw size={11} />
                                }
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