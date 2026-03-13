import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight, Check, Scissors, User, Calendar, Clock, LogIn } from 'lucide-react'
import { format, addMonths, subMonths, getDaysInMonth, startOfMonth, parseISO } from 'date-fns'
import { pt } from 'date-fns/locale'
import { api } from '@/api/client'
import type { Service, Barber } from '@/types'

type Step = 1 | 2 | 3 | 4

interface BookingState {
  service: Service | null
  barber: Barber | null
  date: string
  time: string
  notes: string
}

const INITIAL: BookingState = { service: null, barber: null, date: '', time: '', notes: '' }
const STEP_LABELS = ['Serviço', 'Barbeiro', 'Data & Hora', 'Confirmar']

export default function BookingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [booking, setBooking] = useState<BookingState>(INITIAL)
  const [calMonth, setCalMonth] = useState(new Date())
  const [error, setError] = useState<string | null>(null)

  const isLoggedIn = !!localStorage.getItem('user_token')

  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get<Service[]>('/api/services'),
  })
  const { data: barbersRes } = useQuery({
    queryKey: ['public-barbers'],
    queryFn: () => api.get<Barber[]>('/api/barbers'),
  })
  const { data: slotsRes } = useQuery({
    queryKey: ['slots', booking.barber?.id, booking.date],
    queryFn: () =>
      api.get<string[]>(
        `/api/slots?barber_id=${booking.barber!.id}&date=${booking.date}&service_id=${booking.service!.id}`
      ),
    enabled: !!booking.barber && !!booking.date && !!booking.service,
  })

  const services = servicesRes?.data ?? []
  const barbers  = barbersRes?.data ?? []
  const slots    = slotsRes?.data ?? []

  const confirmMutation = useMutation({
    mutationFn: () =>
      api.post('/api/reservations', {
        service_id: booking.service!.id,
        barber_id:  booking.barber!.id,
        date:       booking.date,
        time:       booking.time,
        notes:      booking.notes || undefined,
      }),
    onSuccess: () => navigate('/reservations?confirmed=1'),
    onError: (e: Error) => setError(e?.message ?? 'Erro ao confirmar reserva.'),
  })

  const today     = new Date()
  const firstDay  = startOfMonth(calMonth).getDay() || 7
  const daysCount = getDaysInMonth(calMonth)
  const calDays: (number | null)[] = [
    ...Array.from({ length: firstDay - 1 }, (): null => null),
    ...Array.from({ length: daysCount }, (_, i) => i + 1),
  ]

  const selectDate = (day: number) => {
    const d = new Date(calMonth.getFullYear(), calMonth.getMonth(), day)
    if (d < today && format(d, 'yyyy-MM-dd') !== format(today, 'yyyy-MM-dd')) return
    if (d.getDay() === 0) return
    setBooking(b => ({ ...b, date: format(d, 'yyyy-MM-dd'), time: '' }))
  }

  const canNext = (
    (step === 1 && !!booking.service) ||
    (step === 2 && !!booking.barber) ||
    (step === 3 && !!booking.date && !!booking.time) ||
    step === 4
  )

  // Se chegar ao passo 4 sem estar autenticado, mostra gate
  const showLoginGate = step === 4 && !isLoggedIn

  return (
    <div className="min-h-screen relative flex items-start justify-center pt-24 pb-16 px-4">
      <video className="fixed inset-0 w-full h-full object-cover -z-10"
             autoPlay muted loop playsInline
             src="/video/video_background_barbeariabrooklyn.mp4" />
      <div className="fixed inset-0 bg-black/70 -z-10" />

      <div className="w-full max-w-xl">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-8">
          {STEP_LABELS.map((label, i) => {
            const n = (i + 1) as Step
            const active    = step === n
            const completed = step > n
            return (
              <div key={n} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all ${
                    completed ? 'bg-brand-500 text-white' :
                    active    ? 'bg-white text-gray-900' :
                                'bg-white/10 text-gray-400'
                  }`}>
                  {completed ? <Check size={14} /> : n}
                </div>
                <span className={`text-sm hidden sm:block ${
                  active ? 'text-white font-semibold' : 'text-gray-500'
                }`}>{label}</span>
                {i < 3 && <div className="h-px flex-1 bg-white/10 min-w-[20px]" />}
              </div>
            )
          })}
        </div>

        <div className="bg-gray-900/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/10">
          {/* LOGIN GATE — sobreposto ao passo 4 se não estiver autenticado */}
          {showLoginGate ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-brand-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
                <LogIn size={28} className="text-brand-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Precisas de fazer login</h2>
              <p className="text-gray-400 text-sm mb-6">
                Para confirmar a reserva é necessário ter sessão iniciada.
              </p>
              <div className="space-y-3">
                <Link
                  to="/login?redirect=/reservar"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-brand-500
                             text-white font-semibold rounded-xl hover:bg-brand-600 transition-colors"
                >
                  <LogIn size={18} /> Fazer login
                </Link>
                <button
                  onClick={() => setStep(3)}
                  className="w-full py-3 bg-white/5 text-gray-400 rounded-xl hover:bg-white/10
                             text-sm transition-all"
                >
                  Voltar e alterar data
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-4">
                Sem conta?{' '}
                <Link to="/login?redirect=/reservar" className="text-brand-400 hover:underline">
                  Regista-te gratuitamente
                </Link>
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
                  {services.map(s => (
                    <button key={s.id}
                      onClick={() => setBooking(b => ({ ...b, service: s }))}
                      className={`flex items-center justify-between p-4 rounded-2xl border
                        transition-all text-left ${
                          booking.service?.id === s.id
                            ? 'bg-brand-500/20 border-brand-500 text-white'
                            : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'
                        }`}>
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          <Clock size={12} className="inline mr-1" />{s.duration} min
                        </p>
                      </div>
                      <span className="text-brand-400 font-bold text-lg">{(s.price / 100).toFixed(0)}€</span>
                    </button>
                  ))}
                </div>
              )}

              {/* PASSO 2 */}
              {step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {barbers.map(b => (
                    <button key={b.id}
                      onClick={() => setBooking(bk => ({ ...bk, barber: b }))}
                      className={`flex items-center gap-3 p-4 rounded-2xl border transition-all text-left ${
                        booking.barber?.id === b.id
                          ? 'bg-brand-500/20 border-brand-500'
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

              {/* PASSO 3 */}
              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <button onClick={() => setCalMonth(m => subMonths(m, 1))}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
                        <ArrowLeft size={16} />
                      </button>
                      <span className="text-white font-semibold capitalize">
                        {format(calMonth, 'MMMM yyyy', { locale: pt })}
                      </span>
                      <button onClick={() => setCalMonth(m => addMonths(m, 1))}
                              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
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
                        const past = d < new Date(today.setHours(0,0,0,0))
                        const sun  = d.getDay() === 0
                        const sel  = booking.date === format(d, 'yyyy-MM-dd')
                        return (
                          <button key={day} onClick={() => selectDate(day)} disabled={past || sun}
                                  className={`aspect-square rounded-xl text-sm font-medium transition-all ${
                                    sel ? 'bg-brand-500 text-white' :
                                    past || sun ? 'text-gray-700 cursor-not-allowed' :
                                    'text-gray-300 hover:bg-white/10'
                                  }`}>
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
                      {slots.length === 0 ? (
                        <p className="text-center text-gray-500 py-4">Sem horários disponíveis neste dia.</p>
                      ) : (
                        <div className="grid grid-cols-4 gap-2">
                          {slots.map(slot => (
                            <button key={slot}
                              onClick={() => setBooking(b => ({ ...b, time: slot }))}
                              className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                                booking.time === slot ? 'bg-brand-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                              }`}>
                              {slot}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* PASSO 4 */}
              {step === 4 && (
                <div className="space-y-4">
                  {[
                    { icon: Scissors, label: 'Serviço',  value: `${booking.service?.name} — ${((booking.service?.price ?? 0) / 100).toFixed(0)}€` },
                    { icon: User,     label: 'Barbeiro', value: booking.barber?.name ?? '' },
                    { icon: Calendar, label: 'Data',     value: booking.date ? format(parseISO(booking.date), "EEEE, d 'de' MMMM yyyy", { locale: pt }) : '' },
                    { icon: Clock,    label: 'Hora',     value: booking.time },
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                      <Icon size={18} className="text-brand-500 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">{label}</p>
                        <p className="text-white font-semibold capitalize">{value}</p>
                      </div>
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm text-gray-400 mb-1.5">Notas adicionais (opcional)</label>
                    <textarea rows={2} placeholder="Ex: cabelo mais curto nos lados..."
                              value={booking.notes}
                              onChange={e => setBooking(b => ({ ...b, notes: e.target.value }))}
                              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3
                                         text-white placeholder:text-gray-600 text-sm resize-none
                                         focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <p className="text-xs text-gray-600">
                    Ao reservar concorda com as{' '}
                    <Link to="/condicoes-reserva" className="underline hover:text-gray-400">Condições de Reserva</Link>{' '}e{' '}
                    <Link to="/privacidade" className="underline hover:text-gray-400">Política de Privacidade</Link>.
                  </p>
                  {error && (
                    <p className="text-sm text-red-400 bg-red-950/50 border border-red-800/50 rounded-xl px-4 py-2.5">
                      {error}
                    </p>
                  )}
                </div>
              )}

              {/* Navegação */}
              <div className="flex items-center justify-between mt-8">
                <button
                  onClick={() => setStep(s => (s - 1) as Step)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    step === 1 ? 'invisible' : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}>
                  <ArrowLeft size={16} /> Voltar
                </button>

                {step < 4 ? (
                  <button onClick={() => setStep(s => (s + 1) as Step)} disabled={!canNext}
                          className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 text-white
                                     rounded-xl text-sm font-semibold hover:bg-brand-600 transition-all
                                     disabled:opacity-40 disabled:cursor-not-allowed">
                    Continuar <ArrowRight size={16} />
                  </button>
                ) : (
                  <button onClick={() => confirmMutation.mutate()} disabled={confirmMutation.isPending}
                          className="flex items-center gap-2 px-6 py-2.5 bg-brand-500 text-white
                                     rounded-xl text-sm font-semibold hover:bg-brand-600 transition-all
                                     disabled:opacity-40">
                    {confirmMutation.isPending ? (
                      <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
                    ) : (
                      <><Check size={16} /> Confirmar reserva</>
                    )}
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
