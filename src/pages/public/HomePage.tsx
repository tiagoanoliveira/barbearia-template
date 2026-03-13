import { Link } from 'react-router-dom'
import { Scissors, Phone, MapPin, Clock } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center min-h-screen text-center px-4 py-20">
        <div className="w-16 h-16 bg-brand-500 rounded-2xl flex items-center justify-center mb-6">
          <Scissors size={28} className="text-white" />
        </div>
        <h1 className="text-5xl sm:text-6xl font-black tracking-tight mb-4">
          {barberShopConfig.name}
        </h1>
        <p className="text-lg text-gray-400 max-w-md mb-8">
          {barberShopConfig.tagline}
        </p>
        <Link
          to={ROUTES.BOOKING}
          className="px-8 py-4 bg-brand-500 text-white font-bold rounded-2xl
                     hover:bg-brand-600 transition-colors text-lg"
        >
          Reservar agora
        </Link>

        {/* Info rápida */}
        <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-gray-400">
          <span className="flex items-center gap-2">
            <Phone size={14} className="text-brand-500" />{barberShopConfig.phone}
          </span>
          <span className="flex items-center gap-2">
            <MapPin size={14} className="text-brand-500" />{barberShopConfig.address}
          </span>
        </div>
      </section>
    </div>
  )
}
