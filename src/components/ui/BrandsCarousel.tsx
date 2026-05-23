import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

interface Brand {
  id: number
  name: string
  logo_url: string | null
  website_url: string | null
}

/**
 * Banner horizontal com logos de marcas parceiras em loop infinito.
 * Duplica os itens para criar um carrossel CSS sem JavaScript de scroll.
 */
export default function BrandsCarousel() {
  const { data } = useQuery({
    queryKey: ['public-brands'],
    queryFn:  () => api.get<Brand[]>('/api/brands'),
    staleTime: 5 * 60 * 1000,
  })

  const brands: Brand[] = data?.data ?? []

  // Não renderiza nada se não houver marcas
  if (!brands.length) return null

  // Duplicar para o loop ser visúvel
  const items = [...brands, ...brands, ...brands]

  return (
    <section className="py-10 overflow-hidden bg-gray-50 border-y border-gray-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 mb-6 text-center">
        <p className="text-xs font-semibold tracking-widest uppercase text-gray-400">
          Marcas com as quais trabalhamos
        </p>
      </div>

      {/* Faixa do carrossel */}
      <div className="relative">
        {/* Gradientes laterais para fade suave */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-24 z-10
                        bg-gradient-to-r from-gray-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-24 z-10
                        bg-gradient-to-l from-gray-50 to-transparent" />

        <div className="flex brands-scroll gap-12 items-center">
          {items.map((brand, idx) => (
            <BrandItem key={`${brand.id}-${idx}`} brand={brand} />
          ))}
        </div>
      </div>

      {/* Animação CSS */}
      <style>{`
        .brands-scroll {
          display: flex;
          width: max-content;
          animation: brandScroll 30s linear infinite;
        }
        .brands-scroll:hover {
          animation-play-state: paused;
        }
        @keyframes brandScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .brands-scroll {
            animation: none;
            flex-wrap: wrap;
            justify-content: center;
            width: 100%;
          }
        }
      `}</style>
    </section>
  )
}

function BrandItem({ brand }: { brand: Brand }) {
  const inner = brand.logo_url ? (
    <img
      src={brand.logo_url}
      alt={brand.name}
      className="h-10 w-auto max-w-[120px] object-contain grayscale hover:grayscale-0 transition-all duration-300 opacity-60 hover:opacity-100"
      loading="lazy"
    />
  ) : (
    <span className="text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap">
      {brand.name}
    </span>
  )

  if (brand.website_url) {
    return (
      <a
        href={brand.website_url}
        target="_blank"
        rel="noopener noreferrer"
        title={brand.name}
        className="flex-shrink-0 flex items-center justify-center px-4"
      >
        {inner}
      </a>
    )
  }

  return (
    <div className="flex-shrink-0 flex items-center justify-center px-4" title={brand.name}>
      {inner}
    </div>
  )
}
