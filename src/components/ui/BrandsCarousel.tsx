import { useQuery } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { api } from '@/api/client'

interface Brand {
  id: number
  name: string
  logo_url: string | null
  website_url: string | null
}

// Velocidade: píxeis por segundo
const SPEED_PX_PER_SEC = 60
// Espaçamento horizontal entre cada logo (px)
const ITEM_GAP = 40

export default function BrandsCarousel() {
  const { data } = useQuery({
    queryKey: ['public-brands'],
    queryFn: () => api.get<Brand[]>('/api/brands'),
    staleTime: 5 * 60 * 1000,
  })

  const brands: Brand[] = data?.data ?? []
  if (brands.length === 0) return null

  return <Marquee brands={brands} />
}

// Componente separado para poder usar hooks após o early return
function Marquee({ brands }: { brands: Brand[] }) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [trackWidth, setTrackWidth] = useState<number | null>(null)

  // Mede a largura real de UMA faixa após render
  useEffect(() => {
    if (!trackRef.current) return
    const measure = () => setTrackWidth(trackRef.current!.scrollWidth)
    measure()
    // Re-mede se o viewport mudar (logos redimensionados)
    const ro = new ResizeObserver(measure)
    ro.observe(trackRef.current)
    return () => ro.disconnect()
  }, [brands])

  // Duração da animação em segundos, proporcional à largura real
  const duration = trackWidth ? trackWidth / SPEED_PX_PER_SEC : 0

  /*
    Estrutura:
      <overflow:hidden>
        <wrapper style="translateX(animation)">   ← move -trackWidth px e volta a 0
          <track ref>  (cópia A — medida)
          <track>      (cópia B — idêntica, colada a A)
        </wrapper>
      </overflow:hidden>

    O gap entre o último item de A e o primeiro de B é garantido por
    "paddingLeft" em cada item (metade do gap de cada lado), de forma que
    qualquer par de items adjacentes — dentro de A, dentro de B, ou na
    junção A→B — tem sempre exactamente ITEM_GAP px entre si.

    Quando o wrapper chega a -trackWidth px, a cópia B está exactamente
    onde A estava no início. A animação salta invisívelmente de volta a 0.
  */

  const trackItems = brands

  return (
    <section className="py-4 bg-white border-y border-gray-100 overflow-hidden">
      <div className="relative w-full">
        {/* Fade nas bordas */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-l from-white to-transparent" />

        {/* Wrapper animado */}
        <div
          className="flex"
          style={{
            // Apenas anima quando a largura está medida
            animation: duration > 0
              ? `marquee-scroll ${duration}s linear infinite`
              : undefined,
            // A variável CSS é usada dentro do @keyframes inline abaixo
            ['--track-w' as string]: trackWidth ? `${trackWidth}px` : '0px',
            willChange: 'transform',
          }}
        >
          {/* Cópia A — usada para medir */}
          <div ref={trackRef} className="flex flex-shrink-0">
            {trackItems.map((brand, i) => (
              <BrandItem key={`a-${brand.id}-${i}`} brand={brand} />
            ))}
          </div>
          {/* Cópia B — idêntica, colocada imediatamente a seguir */}
          <div className="flex flex-shrink-0" aria-hidden>
            {trackItems.map((brand, i) => (
              <BrandItem key={`b-${brand.id}-${i}`} brand={brand} />
            ))}
          </div>
          {/* Cópia B — idêntica, colocada imediatamente a seguir */}
          <div className="flex flex-shrink-0" aria-hidden>
            {trackItems.map((brand, i) => (
                <BrandItem key={`b-${brand.id}-${i}`} brand={brand} />
            ))}
          </div>
          {/* Cópia C — idêntica, colocada imediatamente a seguir */}
          <div className="flex flex-shrink-0" aria-hidden>
            {trackItems.map((brand, i) => (
                <BrandItem key={`b-${brand.id}-${i}`} brand={brand} />
            ))}
          </div>
          {/* Cópia D — idêntica, colocada imediatamente a seguir */}
          <div className="flex flex-shrink-0" aria-hidden>
            {trackItems.map((brand, i) => (
                <BrandItem key={`b-${brand.id}-${i}`} brand={brand} />
            ))}
          </div>
        </div>

        {/* @keyframes inline com a variável CSS da largura real */}
        {trackWidth && (
          <style>{`
            @keyframes marquee-scroll {
              0%   { transform: translateX(0); }
              100% { transform: translateX(-${trackWidth}px); }
            }
          `}</style>
        )}
      </div>
    </section>
  )
}

function BrandItem({ brand }: { brand: Brand }) {
  // Padding horizontal em vez de gap: garante espaçamento uniforme
  // mesmo na junção entre a cópia A e a cópia B.
  const style = { paddingLeft: ITEM_GAP / 2, paddingRight: ITEM_GAP / 2 }

  const inner = (
    <div
      className="flex-shrink-0 flex items-center justify-center h-14
                 opacity-60 hover:opacity-100 transition-opacity duration-300
                 grayscale hover:grayscale-0"
      style={style}
    >
      {brand.logo_url ? (
        <img
          src={brand.logo_url}
          alt={brand.name}
          className="h-14 w-auto max-w-[120px] object-contain"
          loading="lazy"
        />
      ) : (
        <span className="text-gray-500 font-semibold text-sm whitespace-nowrap">
          {brand.name}
        </span>
      )}
    </div>
  )

  if (brand.website_url) {
    return (
      <a href={brand.website_url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
        {inner}
      </a>
    )
  }
  return <div className="flex-shrink-0">{inner}</div>
}
