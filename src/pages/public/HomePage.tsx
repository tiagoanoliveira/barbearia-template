import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, Phone, ChevronDown, ArrowRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'
import type { Service, Barber } from '@/types'

import heroVideo   from '@/media/video/apresentation.mp4'
import aboutImg    from '@/media/images/cliente-corte.png'
import galleryImg1 from '@/media/images/brooklyn/Entrada.jpg'
import galleryImg2 from '@/media/images/brooklyn/Cadeiras.jpg'
import galleryImg3 from '@/media/images/brooklyn/Sinuca.jpg'

const galleryImages = [
  { src: galleryImg1, alt: 'Entrada da barbearia' },
  { src: galleryImg2, alt: 'Cadeiras' },
  { src: galleryImg3, alt: 'Mesa de sinuca' },
]

// ─── Galeria com scroll lateral ──────────────────────────────────────────────
function Gallery() {
  const [current, setCurrent] = useState(0)
  const count = galleryImages.length

  const prev = () => setCurrent(c => (c - 1 + count) % count)
  const next = () => setCurrent(c => (c + 1) % count)

  return (
    <div className="relative max-w-5xl mx-auto select-none">
      {/* Pista de slides */}
      <div className="overflow-hidden rounded-2xl">
        <div
          className="flex transition-transform duration-500 ease-in-out"
          style={{ transform: `translateX(-${current * 100}%)` }}
        >
          {galleryImages.map((img, i) => (
            <div key={i} className="flex-shrink-0 w-full" style={{ maxHeight: 480 }}>
              <img src={img.src} alt={img.alt}
                   className="w-full object-cover" style={{ height: 480 }} />
            </div>
          ))}
        </div>
      </div>

      {/* Em desktop mostramos 3 em grelha estática se ≤ 3 fotos; caso contrário, setas */}
      {count > 1 && (
        <>
          <button onClick={prev}
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10
                       w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm
                       flex items-center justify-center text-white
                       hover:bg-black/70 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <button onClick={next}
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10
                       w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm
                       flex items-center justify-center text-white
                       hover:bg-black/70 transition-colors">
            <ChevronRightIcon size={20} />
          </button>
          {/* Dots */}
          <div className="flex justify-center gap-2 mt-4">
            {galleryImages.map((_, i) => (
              <button key={i} onClick={() => setCurrent(i)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === current ? 'bg-secondary-400' : 'bg-white/30'
                }`} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

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
  const barbers  = barbersRes?.data  ?? []

  return (
    <div className="text-white">

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">
        {/* Espelhos laterais desfocados (desktop) */}
        <div aria-hidden="true" className="hidden md:flex absolute inset-0 w-full h-full">
          <div className="flex-1 overflow-hidden">
            <video className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)', filter: 'blur(20px) brightness(0.45)' }}
              autoPlay muted loop playsInline src={heroVideo} />
          </div>
          <div className="flex-1 overflow-hidden">
            <video className="w-full h-full object-cover"
              style={{ filter: 'blur(20px) brightness(0.45)' }}
              autoPlay muted loop playsInline src={heroVideo} />
          </div>
        </div>

        {/* Vídeo principal */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <video ref={videoRef}
            className="h-full w-auto object-cover"
            style={{ maxWidth: '100%' }}
            autoPlay muted loop playsInline src={heroVideo} />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/75" />

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <p className="text-secondary-400 text-sm font-semibold tracking-widest uppercase mb-4">
            Porto, desde 2018
          </p>
          <h1 className="text-5xl sm:text-7xl font-black tracking-tight mb-6 leading-none">
            {barberShopConfig.name}
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 mb-10 max-w-xl mx-auto leading-relaxed">
            {barberShopConfig.tagline}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to={ROUTES.BOOKING}
              className="flex items-center gap-2 px-8 py-4 bg-primary-500 text-white
                         font-bold rounded-2xl hover:bg-primary-600 transition-all
                         hover:scale-105 active:scale-100 text-base shadow-lg shadow-primary-900/40">
              Reservar agora <ArrowRight size={18} />
            </Link>
            <a href="#servicos"
              className="flex items-center gap-2 px-8 py-4 bg-white/10 text-white
                         font-semibold rounded-2xl hover:bg-white/20 transition-all
                         backdrop-blur-sm text-base">
              Ver serviços
            </a>
          </div>
        </div>

        <a href="#about"
          className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col
                     items-center gap-2 text-gray-400 hover:text-white transition-colors z-10">
          <span className="text-xs tracking-widest uppercase">Scroll</span>
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      {/* ── SOBRE ─────────────────── fundo cinza claro ──────────────────── */}
      <section id="about" className="py-24 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">
                A nossa história
              </p>
              <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">
                Bem-vindo à Brooklyn
              </h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Desde 2018 no coração do Porto, a <strong className="text-gray-900">{barberShopConfig.name}</strong> oferece
                uma experiência única de cuidado masculino. Combinamos técnicas clássicas com
                as tendências mais modernas do mundo da barbearia.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                Os nossos barbeiros especializados estão prontos para proporcionar o melhor
                serviço, num ambiente acolhedor e autêntico.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <MapPin size={16} className="text-primary-600 flex-shrink-0" />
                  <span>{barberShopConfig.address}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Phone size={16} className="text-primary-600 flex-shrink-0" />
                  <a href={`tel:${barberShopConfig.phone}`} className="hover:text-primary-600 transition-colors">
                    {barberShopConfig.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-700">
                  <Clock size={16} className="text-primary-600 flex-shrink-0" />
                  <span>Seg–Sex 10h–20h &nbsp;|&nbsp; Sáb 9h–18h</span>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden shadow-xl">
                <img src={aboutImg} alt="Brooklyn Barbearia — ambiente"
                     className="w-full h-full object-cover" />
              </div>
              {/* Badge secundário */}
              <div className="absolute -bottom-4 -left-4 bg-secondary-500 rounded-2xl p-4 shadow-xl">
                <p className="text-white font-bold text-sm">Desde 2018</p>
                <p className="text-secondary-200 text-xs">no coração do Porto</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ──────────────── fundo branco ───────────────────────── */}
      <section id="servicos" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">O que fazemos</p>
            <h2 className="text-4xl font-black text-gray-900">Serviços</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.id}
                className="group bg-gray-50 rounded-2xl p-6 border border-gray-100
                           hover:border-primary-200 hover:bg-primary-50/40
                           transition-all duration-300 hover:-translate-y-1">
                {/* Abreviação colorida com a cor secundária */}
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center"
                     style={{ backgroundColor: `${(s as unknown as {color?:string}).color ?? '#d4a017'}22` }}>
                  <span className="text-lg font-black"
                    style={{ color: (s as unknown as {color?:string}).color ?? '#d4a017' }}>
                    {(s as unknown as {abreviacao?:string}).abreviacao ?? s.name.slice(0,2).toUpperCase()}
                  </span>
                </div>
                <h3 className="text-gray-900 font-bold text-lg mb-1">{s.name}</h3>
                <p className="text-gray-500 text-sm mb-4">{s.duration} min</p>
                <p className="text-secondary-600 font-black text-2xl">{s.price}€</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={ROUTES.BOOKING}
              className="inline-flex items-center gap-2 px-8 py-4 bg-primary-500
                         text-white font-bold rounded-2xl hover:bg-primary-600
                         transition-all hover:scale-105">
              Reservar agora <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── EQUIPA ─────────────────── fundo cinza claro ──────────────────── */}
      <section id="equipa" className="py-24 bg-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">Os nossos profissionais</p>
            <h2 className="text-4xl font-black text-gray-900">A equipa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {barbers.map((b) => (
              <div key={b.id} className="text-center group">
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full"
                       style={{ background: `${b.color ?? '#d4a017'}22` }} />
                  {b.photo_url
                    ? <img src={b.photo_url} alt={b.name}
                           className="relative w-full h-full rounded-full object-cover
                                      border-4 border-white shadow-md
                                      group-hover:border-primary-400 transition-colors" />
                    : <div className="relative w-full h-full rounded-full border-4 border-white shadow-md
                                     group-hover:border-primary-400 transition-colors
                                     flex items-center justify-center text-5xl font-black"
                           style={{ background: `${b.color ?? '#d4a017'}33`, color: b.color ?? '#d4a017' }}>
                        {b.name[0]}
                      </div>
                  }
                </div>
                <h3 className="text-gray-900 font-bold text-xl">{b.name}</h3>
                <p className="text-primary-600 text-sm mt-1">
                  {(b as unknown as {especialidades?:string}).especialidades ?? 'Barbeiro'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALERIA ───────────────── fundo branco ────────────────────────── */}
      <section id="galeria" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">O nosso espaço</p>
            <h2 className="text-4xl font-black text-gray-900">Galeria</h2>
          </div>
          <Gallery />
        </div>
      </section>

      {/* ── CONTACTO ──────────────── fundo cinza médio ───────────────────── */}
      <section id="contacto" className="py-24 bg-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">Onde estamos</p>
              <h2 className="text-4xl font-black text-gray-900 mb-6">Contacto</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-900 font-medium">Morada</p>
                    <p className="text-gray-600 text-sm">{barberShopConfig.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-900 font-medium">Horário</p>
                    <p className="text-gray-600 text-sm">Segunda a Sexta: 10h–20h</p>
                    <p className="text-gray-600 text-sm">Sábado: 9h–18h</p>
                    <p className="text-gray-600 text-sm">Domingo: Fechado</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={18} className="text-primary-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-gray-900 font-medium">Telefone</p>
                    <a href={`tel:${barberShopConfig.phone}`}
                       className="text-primary-600 hover:text-primary-700 transition-colors text-sm">
                      {barberShopConfig.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden h-80 bg-gray-200 shadow-md">
              <iframe
                title="Localização"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(barberShopConfig.address)}&output=embed`}
                width="100%" height="100%"
                style={{ border: 0 }}
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
