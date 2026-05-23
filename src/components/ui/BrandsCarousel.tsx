import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

interface Brand {
  id: number
  name: string
  logo_url: string | null
  website_url: string | null
}

// Quantas cópias do array garantem que o conteúdo é sempre maior que qualquer ecrã.
// Com poucas marcas (ex: 3) precisamos de mais repetições.
const MIN_COPIES = 8

export default function BrandsCarousel() {
  const { data } = useQuery({
    queryKey: ['public-brands'],
    queryFn: () => api.get<Brand[]>('/api/brands'),
    staleTime: 5 * 60 * 1000,
  })

  const brands: Brand[] = data?.data ?? []
  if (brands.length === 0) return null

  // Garante sempre pelo menos MIN_COPIES repetições, mesmo com 1-2 marcas
  const copies = Math.ceil(MIN_COPIES / brands.length)
  // "Uma faixa" = brands * copies. Usamos DUAS faixas idênticas lado a lado.
  // A animação move -100% da primeira faixa, ficando invisível o "salto".
  const track = Array.from({ length: copies }, () => brands).flat()

  return (
    <section className="py-4 bg-white border-y border-gray-100 overflow-hidden">
      <div className="relative w-full">
        {/* Fade nas bordas */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-r from-white to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10
                        bg-gradient-to-l from-white to-transparent" />

        {/*
          Estrutura:  [ wrapper ]
                        [ track-1 ] [ track-2 ]
          - wrapper: flex, nowrap, width: max-content (envolve as duas faixas)
          - cada track: flex, nowrap, gap igual
          - a animação move o wrapper -50% (= largura de uma faixa) com linear infinite
          - como as duas faixas são idênticas, ao voltar ao 0% o visual é exactamente
            o mesmo → loop perfeitamente invisível
          - o gap entre o último item de track-1 e o primeiro de track-2 é tratado
            com padding-right em cada item em vez de gap no container, para que o
            espaçamento seja sempre uniforme (gap só funciona entre irmãos directos).
        */}
        <div className="flex w-max animate-brands-scroll">
          {[0, 1].map(trackIdx => (
            <div
              key={trackIdx}
              aria-hidden={trackIdx === 1 ? true : undefined}
              className="flex"
            >
              {track.map((brand, i) => (
                <BrandItem key={`t${trackIdx}-${brand.id}-${i}`} brand={brand} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function BrandItem({ brand }: { brand: Brand }) {
  /*
    O espaçamento entre items é feito com px-8 (padding horizontal) em cada item.
    Assim o "gap" entre o último item da faixa 1 e o primeiro da faixa 2 é
    exactamente igual ao gap entre quaisquer outros dois items — o loop fica invisível.
  */
  const inner = (
    <div className="flex-shrink-0 flex items-center justify-center h-16 px-8
                    opacity-60 hover:opacity-100 transition-opacity duration-300
                    grayscale hover:grayscale-0">
      {brand.logo_url ? (
        <img
          src={brand.logo_url}
          alt={brand.name}
          className="h-10 w-auto max-w-[120px] object-contain"
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
  return inner
}
