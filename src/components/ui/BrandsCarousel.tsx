import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'

interface Brand {
  id: number
  name: string
  logo_url: string | null
  website_url: string | null
}

export default function BrandsCarousel() {
  const { data } = useQuery({
    queryKey: ['public-brands'],
    queryFn: () => api.get<Brand[]>('/api/brands'),
    staleTime: 5 * 60 * 1000,
  })

  const brands: Brand[] = data?.data ?? []
  if (brands.length === 0) return null

  return (
      <section className="py-4 bg-white border-y border-gray-100 overflow-hidden">
        <div className="relative w-full">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-white to-transparent" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-white to-transparent" />

          {/* Container exterior: flex sem wrap, contém dois tracks */}
          <div className="flex w-full">
            {/* Track 1 e Track 2 — idênticos, animam juntos */}
            {[0, 1].map(trackIdx => (
                <div
                    key={trackIdx}
                    aria-hidden={trackIdx === 1}
                    className="flex flex-shrink-0 gap-12 animate-brands-scroll"
                >
                  {brands.map((brand, i) => (
                      <BrandItem key={`${brand.id}-${i}`} brand={brand} />
                  ))}
                </div>
            ))}
          </div>
        </div>
      </section>
  )
}

function BrandItem({ brand }: { brand: Brand }) {
  const content = (
      <div className="flex-shrink-0 flex items-center justify-center h-16
                    opacity-60 hover:opacity-100 transition-opacity duration-300 grayscale hover:grayscale-0">
        {brand.logo_url ? (
            <img
                src={brand.logo_url}
                alt={brand.name}
                className="h-16 w-auto max-w-[120px] object-contain"
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
    return <a href={brand.website_url} target="_blank" rel="noopener noreferrer">{content}</a>
  }
  return content
}