import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, Phone, Star, ChevronDown, ArrowRight } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'
import type { Service, Barber } from '@/types'

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement>(null)

  const { data: servicesRes } = useQuery({
    queryKey: ['public-services'],
    queryFn: () => api.get<Service[]>('/api/services'),
  })

  const { data: barbersRes } = useQuery({
    queryKey: ['public-barbers'],
    queryFn: () => api.get<Barber[]>('/api/barbers'),
  })

  const services = servicesRes?.data ?? []
  const barbers  = barbersRes?.data ?? []

  return (
    <div className="text-white">

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          autoPlay muted loop playsInline
          src="/video/video_background_barbeariabrooklyn.mp4"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <p className="text-brand-400 text-sm font-semibold tracking-widest uppercase mb-4">
            Porto, desde 2018
          </p>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-none">
            {barberShopConfig.name}
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-xl mx-auto leading-relaxed">
            {barberShopConfig.tagline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to={ROUTES.BOOKING}
              className="flex items-center gap-2 px-8 py-4 bg-brand-500 text-white
                         font-bold rounded-2xl hover:bg-brand-600 transition-all
                         hover:scale-105 active:scale-100 text-base shadow-lg shadow-brand-500/30"
            >
              Reservar agora <ArrowRight size={18} />
            </Link>
            <a
              href="#servicos"
              className="flex items-center gap-2 px-8 py-4 bg-white/10 text-white
                         font-semibold rounded-2xl hover:bg-white/20 transition-all
                         backdrop-blur-sm text-base"
            >
              Ver serviços
            </a>
          </div>
        </div>

        <a
          href="#about"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col
                     items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      {/* ── SOBRE ────────────────────────────────────────────── */}
      <section id="about" className="py-24 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">
                A nossa história
              </p>
              <h2 className="text-4xl font-black text-white mb-6 leading-tight">
                Bem-vindo à Brooklyn
              </h2>
              <p className="text-gray-400 leading-relaxed mb-4">
                Desde 2018 no coração do Porto, a <strong className="text-white">{barberShopConfig.name}</strong> oferece
                uma experiência única de cuidado masculino. Combinamos técnicas clássicas com
                as tendências mais modernas do mundo da barbearia.
              </p>
              <p className="text-gray-400 leading-relaxed mb-8">
                Os nossos barbeiros especializados estão prontos para proporcionar-lhe o melhor
                serviço, num ambiente acolhedor e autêntico.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <MapPin size={16} className="text-brand-500 flex-shrink-0" />
                  {barberShopConfig.address}
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Clock size={16} className="text-brand-500 flex-shrink-0" />
                  Seg–Sex: 10h–20h &nbsp;·&nbsp; Sáb: 9h–18h
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Phone size={16} className="text-brand-500 flex-shrink-0" />
                  <a href={`tel:${barberShopConfig.phone}`} className="hover:text-white transition-colors">
                    {barberShopConfig.phone}
                  </a>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden bg-gray-800">
                <img
                  src="/images/Resultado.jpg"
                  alt="Resultado Brooklyn"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              <div className="absolute -bottom-6 -left-6 bg-brand-500 rounded-2xl p-4 shadow-xl">
                <p className="text-white font-black text-3xl leading-none">+300</p>
                <p className="text-brand-100 text-xs font-medium mt-0.5">avaliações Google</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ─────────────────────────────────────────── */}
      <section id="servicos" className="py-24 bg-black/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">Preçario</p>
            <h2 className="text-4xl font-black text-white">Os nossos serviços</h2>
          </div>

          {services.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white/5 rounded-2xl p-6 animate-pulse">
                  <div className="h-5 bg-white/10 rounded mb-3 w-2/3" />
                  <div className="h-4 bg-white/10 rounded mb-2 w-full" />
                  <div className="h-4 bg-white/10 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {services.map(service => (
                <div
                  key={service.id}
                  className="group relative bg-white/5 hover:bg-white/10 border border-white/10
                             hover:border-brand-500/40 rounded-2xl p-6 transition-all duration-300
                             hover:-translate-y-1 cursor-pointer"
                  onClick={() => window.location.href = ROUTES.BOOKING}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-white font-semibold text-base">{service.name}</h3>
                    <span className="flex-shrink-0 text-brand-400 font-bold text-lg">
                      {(service.price / 100).toFixed(0)}€
                    </span>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">
                    <Clock size={12} className="inline mr-1" />{service.duration} min
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-brand-500 text-sm
                                  font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Reservar <ArrowRight size={14} />
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-center mt-10">
            <Link
              to={ROUTES.BOOKING}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500
                         text-white font-bold rounded-2xl hover:bg-brand-600 transition-all"
            >
              Agendar serviço <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── EQUIPA ──────────────────────────────────────────── */}
      <section id="equipa" className="py-24 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">Profissionais</p>
            <h2 className="text-4xl font-black text-white">A nossa equipa</h2>
          </div>

          {barbers.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white/5 rounded-3xl overflow-hidden animate-pulse">
                  <div className="aspect-[3/4] bg-white/10" />
                  <div className="p-5">
                    <div className="h-5 bg-white/10 rounded w-2/3 mb-2" />
                    <div className="h-4 bg-white/10 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {barbers.map(barber => (
                <div key={barber.id}
                     className="group bg-white/5 rounded-3xl overflow-hidden
                                hover:bg-white/10 transition-all duration-300 hover:-translate-y-2">
                  <div className="aspect-[3/4] bg-gray-800 overflow-hidden">
                    {barber.photo_url ? (
                      <img src={barber.photo_url} alt={barber.name}
                           className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                           loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-6xl font-black text-gray-700">{barber.name.charAt(0)}</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <h3 className="text-white font-bold text-lg">{barber.name}</h3>
                    <p className="text-gray-500 text-sm">Barbeiro</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── GALERIA ─────────────────────────────────────────── */}
      <section id="galeria" className="py-24 bg-black/20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">Espaço</p>
            <h2 className="text-4xl font-black text-white">O nosso espaço</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="col-span-2 md:col-span-1 row-span-2">
              <div className="h-full rounded-3xl overflow-hidden bg-gray-800 min-h-[300px]">
                <img src="/images/brooklyn/Cadeiras.jpg" alt="Cadeiras"
                     className="w-full h-full object-cover" loading="lazy" />
              </div>
            </div>
            <div className="aspect-square rounded-3xl overflow-hidden bg-gray-800">
              <img src="/images/brooklyn/Entrada.jpg" alt="Entrada"
                   className="w-full h-full object-cover" loading="lazy" />
            </div>
            <div className="aspect-square rounded-3xl overflow-hidden bg-gray-800">
              <img src="/images/brooklyn/Sinuca.jpg" alt="Interior"
                   className="w-full h-full object-cover" loading="lazy" />
            </div>
          </div>
        </div>
      </section>

      {/* ── REVIEWS ─────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="inline-flex items-center gap-4 bg-white/5 border border-white/10
                          rounded-2xl px-8 py-6 mb-8">
            <img src="/images/google_favicon_2025.png" alt="Google" className="w-8 h-8" />
            <div className="text-left">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-3xl">4.8</span>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={18}
                          className={i < 4 ? 'fill-brand-500 text-brand-500' : 'fill-brand-500/40 text-brand-500/40'} />
                  ))}
                </div>
              </div>
              <p className="text-gray-500 text-sm">Baseado em +300 avaliações Google</p>
            </div>
          </div>
          <p className="text-gray-400 text-lg mb-8">A satisfação dos clientes é a nossa maior recompensa.</p>
          <a href="https://g.page/r/review" target="_blank" rel="noopener noreferrer"
             className="inline-flex items-center gap-2 px-8 py-4 bg-white/10
                        text-white font-semibold rounded-2xl hover:bg-white/20 transition-all">
            Deixar avaliação <ArrowRight size={18} />
          </a>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────── */}
      <section className="py-24 bg-brand-500">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-4xl font-black text-white mb-4">Pronto para o próximo corte?</h2>
          <p className="text-brand-100 text-lg mb-10">Reserva online em menos de 2 minutos.</p>
          <Link
            to={ROUTES.BOOKING}
            className="inline-flex items-center gap-2 px-10 py-5 bg-white text-brand-600
                       font-black rounded-2xl hover:bg-brand-50 transition-all text-lg
                       shadow-2xl shadow-black/20"
          >
            Fazer reserva <ArrowRight size={22} />
          </Link>
        </div>
      </section>
    </div>
  )
}
