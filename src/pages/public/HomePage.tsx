import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapPin, Clock, Phone, Star, ChevronDown, ArrowRight } from 'lucide-react'
import { api } from '@/api/client'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'
import type { Service, Barber } from '@/types'

// Importa os assets estáticos directamente do repo — Vite trata do hash/bundle
import heroVideo   from '@/media/video/apresentation.mp4'
import aboutImg    from '@/media/images/cliente-corte.png'
import galleryImg1 from '@/media/images/brooklyn/Entrada.jpg'
import galleryImg2 from '@/media/images/brooklyn/Cadeiras.jpg'
import galleryImg3 from '@/media/images/brooklyn/Sinuca.jpg'
import galleryImg4 from '@/media/images/corte-barba-detalhe.jpg'
import galleryImg5 from '@/media/images/corte-cabelo-detalhe.png'
import galleryImg6 from '@/media/images/Resultado.jpg'

const galleryImages = [
  { src: galleryImg1, alt: 'Entrada da barbearia' },
  { src: galleryImg2, alt: 'Cadeiras' },
  { src: galleryImg3, alt: 'Mesa de sinuca' },
  { src: galleryImg4, alt: 'Detalhe de corte de barba' },
  { src: galleryImg5, alt: 'Detalhe de corte de cabelo' },
  { src: galleryImg6, alt: 'Resultado final' },
]

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
      <section className="relative h-screen flex items-center justify-center overflow-hidden bg-black">

        {/*
          Técnica de mirror para vídeo vertical em desktop:
          - Layer 0 (fundo): dois clones espelhados e desfocados nas laterais
          - Layer 1 (frente): o vídeo principal centrado
          Nos mobile (< md) apenas o vídeo principal é visível a full-width.
        */}

        {/* Espelhos laterais — visíveis apenas em desktop */}
        <div aria-hidden="true" className="hidden md:flex absolute inset-0 w-full h-full">
          {/* Esquerdo: flip horizontal + blur */}
          <div className="flex-1 overflow-hidden">
            <video
              className="w-full h-full object-cover scale-x-[-1] blur-xl brightness-50"
              style={{ transform: 'scaleX(-1)', filter: 'blur(20px) brightness(0.45)' }}
              autoPlay muted loop playsInline
              src={heroVideo}
            />
          </div>
          {/* Direito: normal + blur */}
          <div className="flex-1 overflow-hidden">
            <video
              className="w-full h-full object-cover blur-xl brightness-50"
              style={{ filter: 'blur(20px) brightness(0.45)' }}
              autoPlay muted loop playsInline
              src={heroVideo}
            />
          </div>
        </div>

        {/* Vídeo principal — centrado, contido em portrait */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <video
            ref={videoRef}
            className="h-full w-auto max-w-none md:h-full md:w-auto object-cover"
            style={{ maxWidth: '100%' }}
            autoPlay muted loop playsInline
            src={heroVideo}
          />
        </div>

        {/* Gradiente de sobreposição */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/75" />

        {/* Conteúdo */}
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
                     items-center gap-2 text-gray-400 hover:text-white transition-colors z-10"
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
                  <span>{barberShopConfig.address}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Phone size={16} className="text-brand-500 flex-shrink-0" />
                  <a href={`tel:${barberShopConfig.phone}`} className="hover:text-brand-400 transition-colors">
                    {barberShopConfig.phone}
                  </a>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <Clock size={16} className="text-brand-500 flex-shrink-0" />
                  <span>Seg–Sex 10h–20h &nbsp;|&nbsp; Sáb 9h–18h</span>
                </div>
              </div>
            </div>

            {/* Foto da secção About */}
            <div className="relative">
              <div className="aspect-[4/5] rounded-3xl overflow-hidden">
                <img
                  src={aboutImg}
                  alt="Brooklyn Barbearia — ambiente"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="absolute -bottom-4 -left-4 bg-brand-500 rounded-2xl p-4 shadow-xl">
                <div className="flex items-center gap-2">
                  <Star size={18} className="text-white fill-white" />
                  <div>
                    <p className="text-white font-bold text-sm">4.9 / 5</p>
                    <p className="text-brand-200 text-xs">+200 avaliações</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SERVIÇOS ─────────────────────────────────────────── */}
      <section id="servicos" className="py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">O que fazemos</p>
            <h2 className="text-4xl font-black text-white">Os nossos serviços</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((s) => (
              <div key={s.id} className="group relative bg-gray-900 rounded-2xl p-6 border border-gray-800 hover:border-brand-500/50 transition-all duration-300 hover:-translate-y-1">
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center"
                     style={{ backgroundColor: `${(s as unknown as {color?:string}).color ?? '#d4a017'}22` }}>
                  <span className="text-xl font-black" style={{ color: (s as unknown as {color?:string}).color ?? '#d4a017' }}>
                    {(s as unknown as {abreviacao?:string}).abreviacao ?? s.name.slice(0,2).toUpperCase()}
                  </span>
                </div>
                <h3 className="text-white font-bold text-lg mb-2">{s.name}</h3>
                <p className="text-gray-400 text-sm mb-4">{s.duration} min</p>
                <p className="text-brand-400 font-black text-2xl">{s.price}€</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-12">
            <Link to={ROUTES.BOOKING}
              className="inline-flex items-center gap-2 px-8 py-4 bg-brand-500 text-white font-bold rounded-2xl hover:bg-brand-600 transition-all hover:scale-105">
              Reservar agora <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── EQUIPA ───────────────────────────────────────────── */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">Os nossos profissionais</p>
            <h2 className="text-4xl font-black text-white">A nossa equipa</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {barbers.map((b) => (
              <div key={b.id} className="text-center group">
                <div className="relative w-48 h-48 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full" style={{ background: `${b.color ?? '#d4a017'}33` }} />
                  {b.photo_url
                    ? <img src={b.photo_url} alt={b.name}
                           className="relative w-full h-full rounded-full object-cover border-4 border-gray-800 group-hover:border-brand-500 transition-colors" />
                    : <div className="relative w-full h-full rounded-full border-4 border-gray-800 group-hover:border-brand-500 transition-colors flex items-center justify-center text-5xl font-black"
                           style={{ color: b.color ?? '#d4a017' }}>
                        {b.name[0]}
                      </div>
                  }
                </div>
                <h3 className="text-white font-bold text-xl">{b.name}</h3>
                <p className="text-brand-500 text-sm mt-1">{(b as unknown as {especialidades?:string}).especialidades ?? 'Barbeiro'}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALERIA ──────────────────────────────────────────── */}
      <section className="py-24 bg-black">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">O nosso espaço</p>
            <h2 className="text-4xl font-black text-white">Galeria</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {galleryImages.map((img, i) => (
              <div key={i} className={`overflow-hidden rounded-2xl ${ i === 0 ? 'col-span-2 md:col-span-1 md:row-span-2' : '' }`}>
                <img
                  src={img.src}
                  alt={img.alt}
                  className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                  style={{ minHeight: i === 0 ? '320px' : '200px' }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── LOCALIZAÇÃO ──────────────────────────────────────── */}
      <section className="py-24 bg-gray-950">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-brand-500 text-sm font-semibold tracking-widest uppercase mb-3">Onde estamos</p>
              <h2 className="text-4xl font-black text-white mb-6">Encontra-nos</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <MapPin size={18} className="text-brand-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Morada</p>
                    <p className="text-gray-400 text-sm">{barberShopConfig.address}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Clock size={18} className="text-brand-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Horário</p>
                    <p className="text-gray-400 text-sm">Segunda a Sexta: 10h–20h</p>
                    <p className="text-gray-400 text-sm">Sábado: 9h–18h</p>
                    <p className="text-gray-400 text-sm">Domingo: Fechado</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone size={18} className="text-brand-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Telefone</p>
                    <a href={`tel:${barberShopConfig.phone}`} className="text-brand-400 hover:text-brand-300 transition-colors text-sm">
                      {barberShopConfig.phone}
                    </a>
                  </div>
                </div>
              </div>
            </div>
            <div className="rounded-3xl overflow-hidden h-80 bg-gray-800">
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
