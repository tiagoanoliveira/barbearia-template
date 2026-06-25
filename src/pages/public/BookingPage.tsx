import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Check, Scissors, User,
  Calendar, Clock, LogIn, AlertTriangle, Shuffle
} from 'lucide-react'
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { api } from '@/api/client'
import { barberShopConfig, serviceRestrictions } from '@/config/theme'
import type { Service, Barber } from '@/types'

// Barbeiro com preço/duração efectivos para o serviço seleccionado
interface BarberForService extends Barber {
  price:    number
  duration: number
}

type Step = 1 | 2 | 3 | 4

interface BookingState {
  service:     Service | null
  barber:      BarberForService | null
  anyBarber:   boolean
  date:        string
  time:        string
  notes:       string
  // Nome do barbeiro guardado separadamente para mostrar no passo 4
  // mesmo antes de barbersForService terminar de carregar
  barberName:  string
}

interface BookingDraft {
  serviceId:  number | null
  barberId:   number | null
  barberName: string
  anyBarber:  boolean
  date:       string
  time:       string
  notes:      string
  step:       Step
}

const DRAFT_KEY = 'booking_draft_v3'

function getSafeStorage(): Storage | null {
  try { return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null }
  catch { return null }
}

function serviceAvailableOnDay(serviceId: number, dow: number): boolean {
  const r = serviceRestrictions[serviceId]
  return r ? r.allowedDays.includes(dow) : true
}

const DOW_TO_WH_KEY: (keyof typeof barberShopConfig.workingHours)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
]

function isClosedDay(dow: number): boolean {
  const key = DOW_TO_WH_KEY[dow]
  return key ? barberShopConfig.workingHours[key].closed : false
}

const INITIAL: BookingState = {
  service: null, barber: null, anyBarber: false,
  date: '', time: '', notes: '', barberName: '',
}

export default function BookingPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const storage        = useMemo(() => getSafeStorage(), [])

  const [step, setStep]         = useState<Step>(1)
  const [booking, setBooking]   = useState<BookingState>(INITIAL)
  const [calMonth, setCalMonth] = useState(new Date())
  const [error, setError]       = useState<string | null>(null)
  const [tosChecked, setTosChecked] = useState(true)
  const queryClient = useQueryClient()

  const isLoggedIn = !!storage?.getItem('user_token')

  const goToStep = (s: Step) => {
    setStep(s)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }

  // ── Serviços públicos ────────────────────────────────────────────────────
  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn:  () => api.get<Service[]>('/api/services'),
  })
  const services = servicesRes?.data ?? []

  // ── Barbeiros que fazem o serviço seleccionado ───────────────────────────
  const { data: barbersForServiceRes } = useQuery({
    queryKey: ['service-barbers', booking.service?.id],
    queryFn:  () => api.get<BarberForService[]>(`/api/services/${booking.service!.id}/barbers`),
    enabled:  !!booking.service,
  })
  const barbersForService = barbersForServiceRes?.data ?? []

  // Quando há exactamente 1 barbeiro, saltamos o passo de selecção
  const singleBarber: BarberForService | null = barbersForService.length === 1 ? barbersForService[0]! : null

  useEffect(() => {
    if (!singleBarber) return
    setBooking(b => {
      if (!b.anyBarber && b.barber?.id === singleBarber.id) return b
      return { ...b, barber: singleBarber, anyBarber: false, barberName: singleBarber.name }
    })
  }, [singleBarber])

  // ── Restaurar draft ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!services.length || !storage) return
    try {
      const raw = storage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as BookingDraft
      const svc = draft.serviceId ? services.find(s => s.id === draft.serviceId) ?? null : null

      setBooking(b => ({
        ...b,
        service:    svc,
        anyBarber:  !!draft.anyBarber,
        barberName: draft.barberName || '',
        date:       draft.date  || '',
        time:       draft.time  || '',
        notes:      draft.notes || '',
      }))

      // Calcular o passo correcto com os dados disponíveis neste momento.
      // O barbeiro (objecto completo) ainda não está restaurado aqui — só
      // depois de barbersForService carregar. Por isso usamos draft.barberId
      // e draft.anyBarber para decidir se o passo 2 está completo.
      const barberDone = !!draft.anyBarber || !!draft.barberId
      const dateDone   = !!(draft.date && draft.time)

      let targetStep: Step = draft.step ?? 1
      if (targetStep === 4 && !dateDone)   targetStep = 3
      if (targetStep >= 3 && !barberDone && !svc) targetStep = 1
      if (targetStep >= 3 && !barberDone && svc)  targetStep = 2
      if (targetStep === 4 && !dateDone)   targetStep = 3
      if (targetStep >= 1 && !svc)         targetStep = 1

      if (targetStep >= 1 && targetStep <= 4) setStep(targetStep)
    } catch {}
  }, [services, storage])

  // Restaurar barbeiro do draft depois de barbersForService carregar
  useEffect(() => {
    if (!barbersForService.length || !storage || booking.barber) return
    try {
      const raw = storage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw) as BookingDraft
      if (!draft.barberId || draft.anyBarber) return
      const b = barbersForService.find(b => b.id === draft.barberId)
      if (b) setBooking(bk => ({ ...bk, barber: b, barberName: b.name }))
      else {
        // Barbeiro do draft já não existe (inactivo) — volta ao passo 2
        setBooking(bk => ({ ...bk, barber: null, barberName: '', date: '', time: '' }))
        setStep(2)
      }
    } catch {}
  }, [barbersForService, storage, booking.barber])

  // ── Guardar draft ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!storage) return
    const draft: BookingDraft = {
      serviceId:  booking.service?.id ?? null,
      barberId:   booking.anyBarber ? null : (booking.barber?.id ?? null),
      barberName: booking.anyBarber ? '' : booking.barberName,
      anyBarber:  booking.anyBarber,
      date:       booking.date,
      time:       booking.time,
      notes:      booking.notes,
      step,
    }
    try { storage.setItem(DRAFT_KEY, JSON.stringify(draft)) } catch {}
  }, [booking, step, storage])

  // ── service_id na URL ────────────────────────────────────────────────────
  useEffect(() => {
    const id = searchParams.get('service_id')
    if (!id || !services.length || booking.service) return
    const s = services.find(s => String(s.id) === id)
    if (s) setBooking(b => ({ ...b, service: s }))
  }, [searchParams, services, booking.service])

  // ── Pré-carregar slots ───────────────────────────────────────────────────
  useEffect(() => {
    const barberId  = booking.anyBarber ? null : booking.barber?.id
    const serviceId = booking.service?.id
    if (!serviceId || (!barberId && !booking.anyBarber)) return

    const today = new Date()
    for (let i = 0; i < 3; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const dow      = d.getDay()
      const dateStr  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      const closedDay  = isClosedDay(dow)
      const restricted = booking.service ? !serviceAvailableOnDay(booking.service.id, dow) : false
      if (closedDay || restricted) continue

      if (booking.anyBarber) {
        queryClient.prefetchQuery({
          queryKey: ['slots-any', dateStr, serviceId],
          queryFn:  () => api.get<string[]>(`/api/slots-any-barber?date=${dateStr}&service_id=${serviceId}`),
          staleTime: 30_000,
        })
      } else {
        queryClient.prefetchQuery({
          queryKey: ['slots', barberId, dateStr, serviceId],
          queryFn:  () => api.get<string[]>(`/api/slots?barber_id=${barberId}&date=${dateStr}&service_id=${serviceId}`),
          staleTime: 30_000,
        })
      }
    }
  }, [booking.barber?.id, booking.anyBarber, booking.service?.id])

  // ── Slots ─────────────────────────────────────────────────────────────────
  const { data: slotsRes } = useQuery({
    queryKey: ['slots', booking.barber?.id, booking.date, booking.service?.id],
    queryFn:  () =>
        api.get<string[]>(`/api/slots?barber_id=${booking.barber!.id}&date=${booking.date}&service_id=${booking.service!.id}`),
    enabled: !booking.anyBarber && !!booking.barber && !!booking.date && !!booking.service,
  })

  const { data: slotsAnyRes } = useQuery({
    queryKey: ['slots-any', booking.date, booking.service?.id],
    queryFn:  () =>
        api.get<string[]>(`/api/slots-any-barber?date=${booking.date}&service_id=${booking.service!.id}`),
    enabled: booking.anyBarber && !!booking.date && !!booking.service,
  })

  const slots = booking.anyBarber ? (slotsAnyRes?.data ?? []) : (slotsRes?.data ?? [])

  // ── Confirmar reserva ─────────────────────────────────────────────────────
  const confirmMutation = useMutation({
    mutationFn: () => {
      const effectiveBarberId: number | 'any' | undefined = booking.anyBarber
        ? 'any'
        : (booking.barber?.id ?? singleBarber?.id)

      // Verificações de integridade — redireciona para o passo em falta
      if (!booking.service) { goToStep(1); throw new Error('Serviço não definido.') }
      if (!booking.anyBarber && effectiveBarberId === undefined) {
        goToStep(singleBarber === null ? 2 : 1)
        throw new Error('Barbeiro não definido. Por favor seleciona novamente.')
      }
      if (!booking.date || !booking.time) { goToStep(3); throw new Error('Data ou hora não definida.') }

      return api.post('/api/reservations', {
        service_id: booking.service.id,
        barber_id:  effectiveBarberId,
        date:       booking.date,
        time:       booking.time,
        notes:      booking.notes || undefined,
      })
    },
    onSuccess: (res) => {
      if (!res.success) { setError(res.error ?? 'Erro ao confirmar reserva.'); return }
      try { storage?.removeItem(DRAFT_KEY) } catch {}
      navigate('/reservations?confirmed=1')
    },
    onError: (e: Error) => setError(e?.message ?? 'Erro ao confirmar reserva.'),
  })

  // ── Calendário ────────────────────────────────────────────────────────────
  const firstDay  = startOfMonth(calMonth).getDay() || 7
  const daysCount = getDaysInMonth(calMonth)
  const calDays: (number | null)[] = [
    ...Array.from({ length: firstDay - 1 }, (): null => null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]

  const selectDate = (day: number) => {
    const d   = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
    const dow = d.getDay()
    if (d < new Date(new Date().setHours(0,0,0,0))) return
    if (isClosedDay(dow)) return
    if (booking.service && !serviceAvailableOnDay(booking.service.id, dow)) return
    setBooking(b => ({ ...b, date: format(d, 'yyyy-MM-dd'), time: '' }))
  }

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSelectService = (s: Service) => {
    setBooking(bk => ({ ...bk, service: s, barber: null, anyBarber: false, barberName: '', date: '', time: '' }))
  }

  const handleSelectBarber = (barber: BarberForService | null, anyBarber: boolean) => {
    setBooking(bk => ({
      ...bk,
      barber:     anyBarber ? null : barber,
      anyBarber,
      barberName: anyBarber ? '' : (barber?.name ?? ''),
      date:       '',
      time:       '',
    }))
    setTimeout(() => goToStep(3), 200)
  }

  const handleSelectTime = (slot: string) => {
    setBooking(b => ({ ...b, time: slot }))
    setTimeout(() => goToStep(4), 200)
  }

  const handleStepClick = (n: Step) => {
    if (n >= step) return
    goToStep(n)
  }

  const canNext = (
      (step === 1 && !!booking.service) ||
      (step === 2 && (!!booking.barber || booking.anyBarber)) ||
      (step === 3 && !!booking.date && !!booking.time) ||
      (step === 4 && tosChecked)
  )

  const goNext = useCallback(() => {
    if (step === 1 && singleBarber) {
      setBooking(b => ({ ...b, barber: singleBarber, anyBarber: false, barberName: singleBarber.name }))
      goToStep(3)
      return
    }
    goToStep((step + 1) as Step)
  }, [step, singleBarber])

  const goPrev = useCallback(() => {
    const prev: Step = step === 3 && singleBarber ? 1 : (step - 1) as Step
    goToStep(prev)
  }, [step, singleBarber])

  const showLoginGate = step === 4 && !isLoggedIn
  const serviceRestriction = booking.service ? serviceRestrictions[booking.service.id] : null

  const effectivePrice = booking.anyBarber
      ? booking.service?.min_price ?? booking.service?.price
      : booking.barber?.price ?? booking.service?.price

  // Nome do barbeiro para mostrar no passo 4:
  // usa o objecto em memória se disponível, senão o nome guardado no draft
  const displayBarberName = booking.anyBarber
    ? 'Sem preferência (atribuição automática)'
    : (booking.barber?.name ?? singleBarber?.name ?? booking.barberName || '—')

  const steps: { n: Step; label: string }[] = singleBarber
      ? [
        { n: 1, label: 'Serviço' },
        { n: 3, label: 'Data & Hora' },
        { n: 4, label: 'Confirmar' },
      ]
      : [
        { n: 1, label: 'Serviço' },
        { n: 2, label: 'Barbeiro' },
        { n: 3, label: 'Data & Hora' },
        { n: 4, label: 'Confirmar' },
      ]

  return (
      <div className="min-h-screen relative flex items-start justify-center pt-24 pb-16 px-4">
        <video className="fixed inset-0 w-full h-full object-cover -z-10"
               autoPlay muted loop playsInline src={barberShopConfig.media.videoBackground} />
        <div className={`fixed inset-0 -z-10 ${barberShopConfig.theme.bookingOverlay}`} />

        <div className="w-full max-w-xl">
          {/* Step indicator */}
          <div className="flex items-center justify-between mb-8">
            {steps.map(({ n, label }, i) => {
              const active    = step === n
              const completed = step > n
              const clickable = n < step
              return (
                  <div key={n} className="flex items-center gap-2">
                    <button type="button" onClick={() => handleStepClick(n)}
                            disabled={!clickable && !active}
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                                completed ? 'bg-primary-500 text-white cursor-pointer hover:bg-primary-600'
                                    : active  ? 'bg-white text-gray-900 cursor-default'
                                        : 'bg-white/10 text-gray-400 cursor-not-allowed'
                            }`}>
                      {completed ? <Check size={14} /> : steps.indexOf(steps[i]!) + 1}
                    </button>
                    <span className={`text-sm hidden sm:block ${
                        active ? 'text-white font-semibold' : completed ? 'text-gray-400 cursor-pointer' : 'text-gray-500'
                    }`} onClick={() => clickable && handleStepClick(n)}>{label}</span>
                    {i < steps.length - 1 && <div className="h-px flex-1 bg-white/10 min-w-[20px]" />}
                  </div>
              )
            })}
          </div>

          <div className={`rounded-3xl p-6 sm:p-8 shadow-2xl border backdrop-blur-md ${barberShopConfig.theme.bookingCard}`}>
            {showLoginGate ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                    <LogIn size={28} className="text-primary-400" />
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Precisas de fazer login</h2>
                  <p className="text-gray-400 text-sm mb-6">Para confirmar a reserva é necessário ter sessão iniciada.</p>
                  <div className="space-y-3">
                    <Link to="/login?redirect=/reservar"
                          className="w-full flex items-center justify-center gap-2 py-3 bg-primary-500 text-white font-semibold rounded-xl hover:bg-primary-600 transition-colors">
                      <LogIn size={18} /> Fazer login
                    </Link>
                    <button onClick={() => goToStep(3)}
                            className="w-full py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 text-sm transition-all">
                      Voltar e alterar data
                    </button>
                  </div>
                  <p className="text-xs text-gray-600 mt-4">
                    Sem conta? <Link to="/login?redirect=/reservar" className="text-primary-400 hover:underline">Regista-te gratuitamente</Link>
                  </p>
                </div>
            ) : (
                <>
                  <h2 className="text-xl font-bold text-white mb-6">
                    {step === 1 && 'Escolha o serviço'}
                    {step === 2 && 'Escolha o barbeiro'}
                    {step === 3 && 'Escolha a data e hora'}
                    {step === 4 && 'Confirmar reserva'}
                  </h2>

                  {/* ── PASSO 1: Serviço ── */}
                  {step === 1 && (
                      <div className="grid gap-3">
                        {services.map(s => {
                          const hasPriceVar = (s as Service & { has_price_variation?: boolean }).has_price_variation
                          const minPrice    = (s as Service & { min_price?: number }).min_price ?? s.price
                          const restriction = serviceRestrictions[s.id]
                          return (
                              <button key={s.id} onClick={() => handleSelectService(s)}
                                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                                          booking.service?.id === s.id
                                              ? 'bg-primary-500/20 border-primary-500 text-white'
                                              : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                      }`}>
                                <div>
                                  <p className="font-semibold">{s.name}</p>
                                  <p className="text-sm text-gray-500 mt-0.5">
                                    <Clock size={12} className="inline mr-1" />
                                    {s.has_duration_variation
                                        ? <>desde {s.min_duration ?? s.duration} min</>
                                        : <>{s.duration} min</>
                                    }
                                  </p>
                                  {restriction && (
                                      <p className="text-xs text-secondary-400 mt-1 flex items-center gap-1">
                                        <AlertTriangle size={11} /> {restriction.message}
                                      </p>
                                  )}
                                </div>
                                <div className="text-right ml-4 flex-shrink-0">
                                  {hasPriceVar ? (
                                      <span className="text-secondary-400 font-bold text-lg">
                              <span className="text-sm font-normal text-gray-400">desde </span>{minPrice}€
                            </span>
                                  ) : (
                                      <span className="text-secondary-400 font-bold text-lg">{s.price}€</span>
                                  )}
                                </div>
                              </button>
                          )
                        })}
                      </div>
                  )}

                  {/* ── PASSO 2: Barbeiro ── */}
                  {step === 2 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button onClick={() => handleSelectBarber(null, true)}
                                className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                                    booking.anyBarber
                                        ? 'bg-secondary-500/20 border-secondary-400 text-white'
                                        : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                                }`}>
                          <div className="w-12 h-12 rounded-2xl bg-secondary-500/20 flex-shrink-0 flex items-center justify-center">
                            <Shuffle size={20} className="text-secondary-400" />
                          </div>
                          <div>
                            <p className="text-white font-semibold text-sm">Sem preferência</p>
                            <p className="text-xs text-gray-500">Atribuição automática</p>
                          </div>
                        </button>

                        {barbersForService.map(b => {
                          const hasPriceVar = (booking.service as Service & { has_price_variation?: boolean })?.has_price_variation
                          return (
                              <button key={b.id} onClick={() => handleSelectBarber(b, false)}
                                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                                          !booking.anyBarber && booking.barber?.id === b.id
                                              ? 'bg-primary-500/20 border-primary-500'
                                              : 'bg-white/5 border-white/10 hover:bg-white/10'
                                      }`}>
                                <div className="w-12 h-12 rounded-2xl bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                  {b.foto
                                      ? <img src={b.foto} alt={b.name} className="w-full h-full object-cover" />
                                      : <span className="text-white font-bold">{b.name.charAt(0)}</span>}
                                </div>
                                <div>
                                  <p className="text-white font-semibold">{b.name}</p>
                                  {hasPriceVar && (
                                      <p className="text-secondary-400 font-bold text-sm">{b.price}€</p>
                                  )}
                                </div>
                              </button>
                          )
                        })}
                      </div>
                  )}

                  {/* ── PASSO 3: Data & Hora ── */}
                  {step === 3 && (
                      <div className="space-y-6">
                        {serviceRestriction && (
                            <div className="flex items-center gap-2 bg-secondary-500/10 border border-secondary-500/30 rounded-xl px-4 py-2.5 text-secondary-300 text-sm">
                              <AlertTriangle size={15} className="flex-shrink-0" /> {serviceRestriction.message}
                            </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <button onClick={() => setCalMonth(m => subMonths(m, 1))}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                              <ArrowLeft size={16} />
                            </button>
                            <span className="text-white font-semibold capitalize">
                        {format(calMonth, 'MMMM yyyy', { locale: pt })}
                      </span>
                            <button onClick={() => setCalMonth(m => addMonths(m, 1))}
                                    className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                              <ArrowRight size={16} />
                            </button>
                          </div>
                          <div className="grid grid-cols-7 mb-2">
                            {['S','T','Q','Q','S','S','D'].map((d, i) => (
                                <div key={i} className="text-center text-xs text-gray-600 py-1">{d}</div>
                            ))}
                          </div>
                          <div className="grid grid-cols-7 gap-1">
                            {calDays.map((day, i) => {
                              if (!day) return <div key={`e-${i}`} />
                              const d          = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
                              const dow        = d.getDay()
                              const past       = d < new Date(new Date().setHours(0,0,0,0))
                              const closed     = isClosedDay(dow)
                              const restricted = booking.service ? !serviceAvailableOnDay(booking.service.id, dow) : false
                              const disabled   = past || closed || restricted
                              const sel        = booking.date === format(d, 'yyyy-MM-dd')
                              return (
                                  <button key={day} onClick={() => selectDate(day)} disabled={disabled}
                                          className={`aspect-square rounded-xl text-sm font-medium transition-all ${
                                              sel      ? 'bg-primary-500 text-white'
                                                  : disabled ? 'text-gray-700 cursor-not-allowed'
                                                      : 'text-gray-300 hover:bg-white/10'
                                          }${restricted && !closed ? ' line-through opacity-40' : ''}`}>
                                    {day}
                                  </button>
                              )
                            })}
                          </div>
                        </div>
                        {booking.date && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-400 mb-3 capitalize">
                                {format(parseISO(booking.date), "EEEE, d 'de' MMMM", { locale: pt })}
                              </h4>
                              {slots.length === 0
                                  ? <p className="text-center text-gray-500 py-4">Sem horários disponíveis neste dia.</p>
                                  : <div className="grid grid-cols-4 gap-2">
                                    {slots.map(slot => (
                                        <button key={slot} onClick={() => handleSelectTime(slot)}
                                                className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                                                    booking.time === slot ? 'bg-primary-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                                                }`}>{slot}</button>
                                    ))}
                                  </div>
                              }
                            </div>
                        )}
                      </div>
                  )}

                  {/* ── PASSO 4: Confirmar ── */}
                  {step === 4 && (
                      <div className="space-y-4">
                        {[
                          {
                            icon: Scissors, label: 'Serviço',
                            value: `${booking.service?.name} — ${effectivePrice}€`,
                          },
                          {
                            icon: User, label: 'Barbeiro',
                            value: displayBarberName,
                          },
                          {
                            icon: Calendar, label: 'Data',
                            value: booking.date ? format(parseISO(booking.date), "EEEE, d 'de' MMMM yyyy", { locale: pt }) : '',
                          },
                          { icon: Clock, label: 'Hora', value: booking.time },
                        ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                              <Icon size={18} className="text-primary-500 flex-shrink-0" />
                              <div>
                                <p className="text-xs text-gray-500">{label}</p>
                                <p className="text-white font-semibold capitalize">{value}</p>
                              </div>
                            </div>
                        ))}
                        <div>
                          <label className="block text-sm text-gray-400 mb-1.5">Notas adicionais (opcional)</label>
                          <textarea rows={2} placeholder="Ex: cabelo mais curto nos lados..."
                                    value={booking.notes} onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-gray-600 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500" />
                        </div>
                        <label className="flex items-start gap-3 cursor-pointer group">
                          <div className={`mt-0.5 w-5 h-5 rounded-md border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                              tosChecked ? 'bg-primary-500 border-primary-500' : 'border-white/30 group-hover:border-primary-400'
                          }`} onClick={() => setTosChecked(v => !v)}>
                            {tosChecked && <Check size={12} className="text-white" />}
                          </div>
                          <span className="text-xs text-gray-400 leading-relaxed">
                      Ao confirmar a reserva declara que leu e aceitou as{' '}
                            <Link to="/condicoes-reserva" target="_blank" className="text-primary-400 hover:underline">Condições de Reserva</Link>{' '}
                            em vigor.
                    </span>
                        </label>
                        {error && (
                            <p className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-2.5">{error}</p>
                        )}
                      </div>
                  )}

                  {/* Navegação */}
                  <div className="flex items-center justify-between mt-8">
                    <button onClick={goPrev}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                                step === 1 ? 'invisible' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                            }`}>
                      <ArrowLeft size={16} /> Voltar
                    </button>
                    {step < 4 ? (
                        <button onClick={goNext} disabled={!canNext}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed">
                          Continuar <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending || !tosChecked}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary-500 text-white rounded-xl text-sm font-semibold hover:bg-primary-600 transition-all disabled:opacity-40">
                          {confirmMutation.isPending
                              ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                              : <><Check size={16} /> Confirmar reserva</>
                          }
                        </button>
                    )}
                  </div>
                </>
            )}
          </div>
        </div>
      </div>
  )
}
