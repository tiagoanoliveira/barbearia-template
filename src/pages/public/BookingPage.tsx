import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, ArrowRight, Check, Scissors, User,
  Calendar, Clock, LogIn, AlertTriangle, Shuffle
} from 'lucide-react'
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { api } from '@/api/client'
import { barberShopConfig, serviceRestrictions } from '@/config/theme'
import type { Service, Barber } from '@/types'

type Step = 1 | 2 | 3 | 4

interface BookingState {
  service:    Service | null
  barber:     Barber  | null
  anyBarber:  boolean          // opção "Sem preferência"
  date:       string
  time:       string
  notes:      string
}

interface BookingDraft {
  serviceId: number | null
  barberId:  number | null
  anyBarber: boolean
  date:      string
  time:      string
  notes:     string
  step:      Step
}

const ANY_BARBER_ID = 'any'
const INITIAL: BookingState = {
  service: null, barber: null, anyBarber: false, date: '', time: '', notes: '',
}
const STEP_LABELS = ['Serviço', 'Barbeiro', 'Data & Hora', 'Confirmar']
const DRAFT_KEY = 'booking_draft_v1'

function serviceAvailableOnDay(serviceId: number, dow: number): boolean {
  const r = serviceRestrictions[serviceId]
  return r ? r.allowedDays.includes(dow) : true
}

export default function BookingPage() {
  const navigate       = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep]     = useState<Step>(1)
  const [booking, setBooking] = useState<BookingState>(INITIAL)
  const [calMonth, setCalMonth] = useState(new Date())
  const [error, setError]     = useState<string | null>(null)
  const [tosChecked, setTosChecked] = useState(true)

  const isLoggedIn = !!localStorage.getItem('user_token')

  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn:  () => api.get<Service[]>('/api/services'),
  })
  const { data: barbersRes } = useQuery({
    queryKey: ['public-barbers'],
    queryFn:  () => api.get<Barber[]>('/api/barbers'),
  })

  const services = servicesRes?.data ?? []
  const barbers  = barbersRes?.data  ?? []

  // Repor rascunho da reserva após login/refresh
  useEffect(() => {
    if (!services.length || !barbers.length) return
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      console.debug('BookingPage: rascunho bruto lido do localStorage', raw)
      if (!raw) return
      const draft = JSON.parse(raw) as BookingDraft
      console.debug('BookingPage: rascunho parseado', draft)
      if (!draft.serviceId) return
      const service = services.find(s => s.id === draft.serviceId)
      if (!service) return
      const barber  = draft.barberId ? barbers.find(b => b.id === draft.barberId) ?? null : null
      setBooking({
        service,
        barber: draft.anyBarber ? null : barber,
        anyBarber: !!draft.anyBarber,
        date:  draft.date  || '',
        time:  draft.time  || '',
        notes: draft.notes || '',
      })
      const s = draft.step ?? 1
      if (s >= 1 && s <= 4) {
        console.debug('BookingPage: a repor passo a partir do rascunho', s)
        setStep(s as Step)
      }
    } catch (e) {
      console.warn('BookingPage: erro ao ler rascunho da reserva', e)
      // ignora rascunhos inválidos
    }
  }, [services, barbers])

  // Guardar rascunho sempre que o estado muda
  useEffect(() => {
    const draft: BookingDraft = {
      serviceId: booking.service?.id ?? null,
      barberId:  booking.anyBarber ? null : booking.barber?.id ?? null,
      anyBarber: booking.anyBarber,
      date:      booking.date,
      time:      booking.time,
      notes:     booking.notes,
      step,
    }
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
      console.debug('BookingPage: rascunho guardado', draft)
    } catch (e) {
      console.warn('BookingPage: não foi possível guardar o rascunho', e)
      // storage cheia ou indisponível — ignorar
    }
  }, [booking, step])

  // Pré-seleccionar serviço via ?service_id= apenas quando não há rascunho
  useEffect(() => {
    const id = searchParams.get('service_id')
    if (!id || !services.length) return
    if (booking.service) return
    const s = services.find(s => String(s.id) === id)
    if (s) setBooking(b => ({ ...b, service: s }))
  }, [searchParams, services, booking.service])

  // Slots normais (barbeiro específico)
  const { data: slotsRes } = useQuery({
    queryKey: ['slots', booking.barber?.id, booking.date],
    queryFn:  () =>
      api.get<string[]>(`/api/slots?barber_id=${booking.barber!.id}&date=${booking.date}&service_id=${booking.service!.id}`),
    enabled: !booking.anyBarber && !!booking.barber && !!booking.date && !!booking.service,
  })

  // Slots "Sem preferência" (todos os barbeiros)
  const { data: slotsAnyRes } = useQuery({
    queryKey: ['slots-any', booking.date, booking.service?.id],
    queryFn:  () =>
      api.get<string[]>(`/api/slots-any-barber?date=${booking.date}&service_id=${booking.service!.id}`),
    enabled: booking.anyBarber && !!booking.date && !!booking.service,
  })

  const slots = booking.anyBarber
    ? (slotsAnyRes?.data ?? [])
    : (slotsRes?.data ?? [])

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.post('/api/reservations', {
        service_id: booking.service!.id,
        barber_id:  booking.anyBarber ? ANY_BARBER_ID : booking.barber!.id,
        date:       booking.date,
        time:       booking.time,
        notes:      booking.notes || undefined,
      }),
    onSuccess: () => {
      try { localStorage.removeItem(DRAFT_KEY) } catch {}
      navigate('/reservations?confirmed=1')
    },
    onError:   (e: Error) => setError(e?.message ?? 'Erro ao confirmar reserva.'),
  })

  const today     = new Date()
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
    if (dow === 0) return
    if (booking.service && !serviceAvailableOnDay(booking.service.id, dow)) return
    setBooking(b => ({ ...b, date: format(d, 'yyyy-MM-dd'), time: '' }))
  }

  const serviceRestriction = booking.service ? serviceRestrictions[booking.service.id] : null

  const canNext = (
    (step === 1 && !!booking.service) ||
    (step === 2 && (!!booking.barber || booking.anyBarber)) ||
    (step === 3 && !!booking.date && !!booking.time) ||
    (step === 4 && tosChecked)
  )

  const showLoginGate = step === 4 && !isLoggedIn

  const barberDisplayName = booking.anyBarber
    ? 'Sem preferência (atribuição automática)'
    : booking.barber?.name ?? ''

  const { data: slotsData } = { data: slots }

  return (
    <div className="min-h-screen relative flex items-start justify-center pt-24 pb-16 px-4">
      <video className="fixed inset-0 w-full h-full object-cover -z-10"
             autoPlay muted loop playsInline src="/video/video_background_barbeariabrooklyn.mp4" />
      <div className={`fixed inset-0 -z-10 ${barberShopConfig.theme.bookingOverlay}`} />

      <div className="w-full max-w-xl">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step
            const active    = step === n
            const completed = step > n
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  completed ? 'bg-primary-500 text-white'
                  : active  ? 'bg-white text-gray-900'
                             : 'bg-white/10 text-gray-400'
                }`}>
                  {completed ? <Check size={14} /> : n}
                </div>
                <span className={`text-sm hidden sm:block ${ active ? 'text-white font-semibold' : 'text-gray-500' }`}>{label}</span>
                {i < 3 && <div className="h-px flex-1 bg-white/10 min-w-[20px]" />}
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
                <button onClick={() => setStep(3)}
                  className="w-full py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10 text-sm transition-all">
                  Voltar e alterar data
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-4">
                Sem conta? <Link to="/registo?redirect=/reservar" className="text-primary-400 hover:underline">Regista-te gratuitamente</Link>
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

              {/* PASSO 1 */}
              {step === 1 && (
                <div className="grid gap-3">
                  {services.map(s => {
                    const restriction = serviceRestrictions[s.id]
                    return (
                      <button key={s.id}
                        onClick={() => setBooking(b => ({ ...b, service: s, date: '', time: '' }))}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${
                          booking.service?.id === s.id
                            ? 'bg-primary-500/20 border-primary-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}>
                        <div>
                          <p className="font-semibold">{s.name}</p>
                          <p className="text-sm text-gray-500 mt-0.5"><Clock size={12} className="inline mr-1" />{s.duration} min</p>
                          {restriction && (
                            <p className="text-xs text-secondary-400 mt-1 flex items-center gap-1">
                              <AlertTriangle size={11} /> {restriction.message}
                            </p>
                          )}
                        </div>
                        <span className="text-secondary-400 font-bold text-lg ml-4">{s.price}€</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* PASSO 2 — Barbeiro + Sem preferência */}
              {step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Opção "Sem preferência" */}
                  <button
                    onClick={() => setBooking(bk => ({ ...bk, barber: null, anyBarber: true }))}
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

                  {barbers.map(b => (
                    <button key={b.id}
                      onClick={() => setBooking(bk => ({ ...bk, barber: b, anyBarber: false }))}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                        !booking.anyBarber && booking.barber?.id === b.id
                          ? 'bg-primary-500/20 border-primary-500'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}>
                      <div className="w-12 h-12 rounded-2xl bg-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {b.photo_url
                          ? <img src={b.photo_url} alt={b.name} className="w-full h-full object-cover" />
                          : <span className="text-white font-bold">{b.name.charAt(0)}</span>}
                      </div>
                      <p className="text-white font-semibold">{b.name}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* PASSO 3 — Data & Hora */}
              {step === 3 && (
                <div className="space-y-6">
                  {serviceRestriction && (
                    <div className="flex items-center gap-2 bg-secondary-500/10 border border-secondary-500/30 rounded-xl px-4 py-2.5 text-secondary-300 text-sm">
                      <AlertTriangle size={15} className="flex-shrink-0" /> {serviceRestriction.message}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <button onClick={() => setCalMonth(m => subMonths(m, 1))} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
                        <ArrowLeft size={16} />
                      </button>
                      <span className="text-white font-semibold capitalize">
                        {format(calMonth, 'MMMM yyyy', { locale: pt })}
                      </span>
                      <button onClick={() => setCalMonth(m => addMonths(m, 1))} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white">
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
                        const d    = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
                        const dow  = d.getDay()
                        const past       = d < new Date(new Date().setHours(0,0,0,0))
                        const sun        = dow === 0
                        const restricted = booking.service ? !serviceAvailableOnDay(booking.service.id, dow) : false
                        const disabled   = past || sun || restricted
                        const sel        = booking.date === format(d, 'yyyy-MM-dd')
                        return (
                          <button key={day} onClick={() => selectDate(day)} disabled={disabled}
                            className={`aspect-square rounded-xl text-sm font-medium transition-all ${
                              sel      ? 'bg-primary-500 text-white'
                              : disabled ? 'text-gray-700 cursor-not-allowed'
                                         : 'text-gray-300 hover:bg-white/10'
                            }${restricted && !sun ? ' line-through opacity-40' : ''}`}>
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
                      {slotsData.length === 0
                        ? <p className="text-center text-gray-500 py-4">Sem horários disponíveis neste dia.</p>
                        : <div className="grid grid-cols-4 gap-2">
                            {slotsData.map(slot => (
                              <button key={slot} onClick={() => setBooking(b => ({ ...b, time: slot }))}
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

              {/* PASSO 4 — Confirmar */}
              {step === 4 && (
                <div className="space-y-4">
                  {[
                    { icon: Scissors, label: 'Serviço',  value: `${booking.service?.name} — ${booking.service?.price}€` },
                    { icon: User,     label: 'Barbeiro', value: barberDisplayName },
                    { icon: Calendar, label: 'Data',     value: booking.date ? format(parseISO(booking.date), "EEEE, d 'de' MMMM yyyy", { locale: pt }) : '' },
                    { icon: Clock,    label: 'Hora',     value: booking.time },
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

                  {/* ToS */}
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
                <button onClick={() => setStep(s => (s - 1) as Step)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    step === 1 ? 'invisible' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}>
                  <ArrowLeft size={16} /> Voltar
                </button>
                {step < 4 ? (
                  <button onClick={() => setStep(s => (s + 1) as Step)} disabled={!canNext}
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
