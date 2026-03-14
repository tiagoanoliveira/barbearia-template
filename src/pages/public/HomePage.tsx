import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, Phone, ChevronDown, ArrowRight, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'
import type { Service, Barber } from '@/types'

import heroVideo   from '@/media/video/presentation.mp4'
import aboutImg    from '@/media/images/corte-cabelo-detalhe.png'
import galleryImg1 from '@/media/images/brooklyn/Entrada.jpg'
import galleryImg2 from '@/media/images/brooklyn/Cadeiras.jpg'
import galleryImg3 from '@/media/images/brooklyn/Sinuca.jpg'

const galleryImages = [
  { src: galleryImg1, alt: 'Entrada da barbearia' },
  { src: galleryImg2, alt: 'Cadeiras' },
  { src: galleryImg3, alt: 'Mesa de sinuca' },
]

// ── Galeria: grelha em desktop, slideshow em mobile ──────────────────────
function Gallery() {
  const [current, setCurrent] = useState(0)
  const count = galleryImages.length

  return (
    <>
      {/* Desktop: grelha fixa */}
      <div className="hidden md:grid gap-3" style={{
        gridTemplateColumns: `repeat(${Math.min(count, 3)}, 1fr)`,
      }}>
        {galleryImages.map((img, i) => (
          <div key={i} className="overflow-hidden rounded-2xl" style={{ height: 360 }}>
            <img src={img.src} alt={img.alt} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" />
          </div>
        ))}
      </div>

      {/* Mobile: slideshow */}
      <div className="md:hidden relative">
        <div className="overflow-hidden rounded-2xl" style={{ height: 320 }}>
          <div className="flex h-full transition-transform duration-500 ease-in-out"
               style={{ transform: `translateX(-${current * 100}%)` }}>
            {galleryImages.map((img, i) => (
              <div key={i} className="flex-shrink-0 w-full h-full">
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
        {count > 1 && (
          <>
            <button onClick={() => setCurrent(c => (c - 1 + count) % count)}
              className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
              <ChevronLeft size={18} />
            </button>
            <button onClick={() => setCurrent(c => (c + 1) % count)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70">
              <ChevronRightIcon size={18} />
            </button>
            <div className="flex justify-center gap-2 mt-3">
              {galleryImages.map((_, i) => (
                <button key={i} onClick={() => setCurrent(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === current ? 'bg-secondary-400' : 'bg-gray-300'
                  }`} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ── Card de serviço com hover "Reservar" ─────────────────────────────────
function ServiceCard({ service }: { service: Service }) {
  const navigate = useNavigate()
  const goBook = () => navigate(`${ROUTES.BOOKING}?service_id=${service.id}`)
  const color  = (service as unknown as { color?: string }).color ?? '#d4a017'

  return (
    <div
      onClick={goBook}
      className="group relative bg-gray-50 rounded-2xl p-4 border border-gray-100
                 hover:border-primary-300 hover:bg-primary-50/40 transition-all duration-300
                 hover:-translate-y-1 cursor-pointer overflow-hidden"
    >
      {/* Overlay "Reservar" ao hover */}
      <div className="absolute inset-0 bg-primary-600/90 rounded-2xl flex items-center justify-end
                      opacity-0 group-hover:opacity-100 transition-opacity duration-250">
        <span className="flex items-center gap-2 text-primary-600 font-bold text-lg px-4">
          Reservar <ArrowRight size={20} />
        </span>
      </div>

      <h3 className="text-gray-900 font-bold text-lg mb-1">{service.name}</h3>
      <p className="text-gray-500 text-sm mb-4">{service.duration} min</p>
      <p className="font-black text-2xl text-primary-700">{service.price}€</p>
    </div>
  )
}

export default function HomePage() {
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
    <div>

      {/* ── HERO ────────────────────────────────────────────────────────── */}
      <section className="relative h-[100dvh] flex items-center justify-center overflow-hidden bg-black">
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
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <video className="h-full w-auto object-cover" style={{ maxWidth: '100%' }}
            autoPlay muted loop playsInline src={heroVideo} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/75" />
        <div className="absolute bottom-20 left-0 right-0 z-10 text-center px-4 max-w-3xl mx-auto text-white">
          <div className="flex flex-col xs:flex-row items-center justify-center gap-4">
            <a href="#servicos" className="flex items-center gap-2 px-6 py-3 bg-white/10 text-white font-semibold rounded-2xl hover:bg-white/20 transition-all backdrop-blur-sm text-base">
              Ver serviços
            </a>
            <Link to={ROUTES.BOOKING}
              className="flex items-center gap-2 px-6 py-3 bg-primary-500 text-white font-bold rounded-2xl hover:bg-primary-600 transition-all hover:scale-105 text-base shadow-lg">
              Reservar agora <ArrowRight size={18} />
            </Link>
          </div>
        </div>
        <a href="#about" className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-400 hover:text-white transition-colors z-10">
          <ChevronDown size={20} className="animate-bounce" />
        </a>
      </section>

      {/* ── SOBRE ── bg-gray-50 ─────────────────────────────────────────── */}
      <section id="about" className={`py-12 ${barberShopConfig.theme.sectionMedium}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">A nossa história</p>
              <h2 className="text-4xl font-black text-gray-900 mb-6 leading-tight">Bem-vindo à Brooklyn</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Desde 2018 no coração do Porto, a <strong className="text-gray-900">{barberShopConfig.name}</strong> oferece
                uma experiência única de cuidado masculino. Combinamos técnicas clássicas com as tendências mais modernas.
              </p>
              <p className="text-gray-600 leading-relaxed mb-8">
                Os nossos barbeiros estão prontos para proporcionar o melhor serviço, num ambiente acolhedor e autêntico.
              </p>
              <div className="space-y-3">
                {[
                  { Icon: MapPin, text: barberShopConfig.address },
                  { Icon: Phone, text: barberShopConfig.phone, href: `tel:${barberShopConfig.phone}` },
                  { Icon: Clock, text: 'Seg–Sex 10h–20h | Sáb 9h–18h' },
                ].map(({ Icon, text, href }) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-gray-700">
                    <Icon size={15} className="text-primary-600 flex-shrink-0" />
                    {href ? <a href={href} className="hover:text-primary-600 transition-colors">{text}</a> : <span>{text}</span>}
                  </div>
                ))}
              </div>
            </div>
            <div className="relative flex justify-center">
              {/* Altura e largura máximas da foto do about */}
              <div className="overflow-hidden rounded-3xl shadow-xl" style={{ maxWidth: 400, maxHeight: 400 }}>
                <img src={aboutImg} alt="Brooklyn Barbearia" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-4 bg-secondary-500 rounded-2xl p-4 shadow-xl">
                <p className="text-white font-bold text-sm">4,8 / 5,0</p>
                <p className="text-secondary-200 text-xs">+ 300 avaliações</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ── bg-white ─────────────────────────────────────────── */}
      <section id="servicos" className={`py-12 ${barberShopConfig.theme.sectionLight}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">O que fazemos</p>
            <h2 className="text-4xl font-black text-gray-900">Serviços</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {services.map(s => <ServiceCard key={s.id} service={s} />)}
          </div>
        </div>
      </section>

      {/* ── EQUIPA ── bg-gray-100 ────────────────────────────────────────── */}
      <section id="equipa" className={`py-12 ${barberShopConfig.theme.sectionDark}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">Os nossos profissionais</p>
            <h2 className="text-4xl font-black text-gray-900">A equipa</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {barbers.map(b => (
              <div key={b.id} className="text-center">
                <div className="w-24 h-24 mx-auto mb-3 rounded-full overflow-hidden border-2 border-white shadow"
                     style={{ background: `${b.color ?? '#d4a017'}22` }}>
                  {b.photo_url
                    ? <img src={b.photo_url} alt={b.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-3xl font-black"
                           style={{ color: b.color ?? '#d4a017' }}>{b.name[0]}</div>
                  }
                </div>
                <h3 className="text-gray-900 font-bold text-base">{b.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALERIA ── bg-white ──────────────────────────────────────────── */}
      <section id="galeria" className={`py-12 ${barberShopConfig.theme.sectionLight}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">O nosso espaço</p>
            <h2 className="text-4xl font-black text-gray-900">Galeria</h2>
          </div>
          <Gallery />
        </div>
      </section>

      {/* ── CONTACTO ── bg-gray-50 ───────────────────────────────────────── */}
      <section id="contacto" className={`py-12 ${barberShopConfig.theme.sectionMedium}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
            <div>
              <p className="text-primary-600 text-sm font-semibold tracking-widest uppercase mb-3">Onde estamos</p>
              <h2 className="text-4xl font-black text-gray-900 mb-6">Contacto</h2>
              <div className="space-y-5">
                {[
                  { Icon: MapPin, title: 'Morada', text: barberShopConfig.address },
                  { Icon: Clock,  title: 'Horário', lines: ['Segunda a Sexta: 10h–20h', 'Sábado: 9h–18h', 'Domingo: Fechado'] },
                  { Icon: Phone,  title: 'Telefone', text: barberShopConfig.phone, href: `tel:${barberShopConfig.phone}` },
                ].map(({ Icon, title, text, href, lines }) => (
                  <div key={title} className="flex items-start gap-3">
                    <Icon size={17} className="text-primary-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-gray-900 font-medium text-sm">{title}</p>
                      {lines
                        ? lines.map(l => <p key={l} className="text-gray-500 text-sm">{l}</p>)
                        : href
                          ? <a href={href} className="text-primary-600 hover:text-primary-700 text-sm">{text}</a>
                          : <p className="text-gray-500 text-sm">{text}</p>
                      }
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden shadow-md bg-gray-200" style={{ height: 340 }}>
              <iframe title="Localização"
                src={`https://maps.google.com/maps?q=${encodeURIComponent(barberShopConfig.address)}&output=embed`}
                width="100%" height="100%" style={{ border: 0 }} loading="lazy" />
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}
