import { Scissors, Instagram, Phone, MapPin, Clock } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gray-950 border-t border-white/5 text-gray-400">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
                <Scissors size={17} className="text-white" />
              </div>
              <span className="text-white font-bold text-sm">{barberShopConfig.name}</span>
            </div>
            <p className="text-sm leading-relaxed mb-5">{barberShopConfig.description}</p>
            <div className="flex items-center gap-3">
              {barberShopConfig.instagram && (
                <a
                  href={barberShopConfig.instagram}
                  target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center
                             hover:bg-brand-500 hover:text-white transition-all"
                >
                  <Instagram size={16} />
                </a>
              )}
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Navegação</h4>
            <ul className="space-y-2.5">
              {[
                { to: '/#servicos',    label: 'Serviços' },
                { to: '/#equipa',      label: 'Equipa' },
                { to: ROUTES.BOOKING,  label: 'Fazer Reserva' },
                { to: '/perfil',       label: 'A minha conta' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <a href={to} className="text-sm hover:text-white transition-colors">
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">Contacto</h4>
            <ul className="space-y-3">
              <li className="flex items-start gap-2.5 text-sm">
                <MapPin size={15} className="text-brand-500 mt-0.5 flex-shrink-0" />
                {barberShopConfig.address}
              </li>
              <li className="flex items-center gap-2.5 text-sm">
                <Phone size={15} className="text-brand-500 flex-shrink-0" />
                <a href={`tel:${barberShopConfig.phone}`} className="hover:text-white transition-colors">
                  {barberShopConfig.phone}
                </a>
              </li>
            </ul>
          </div>

          {/* Horário */}
          <div>
            <h4 className="text-white text-sm font-semibold mb-4">
              <Clock size={14} className="inline mr-1.5" />
              Horário
            </h4>
            <ul className="space-y-2">
              {[
                { days: 'Segunda a Sexta', hours: '10h – 20h' },
                { days: 'Sábado',          hours: '9h – 18h' },
                { days: 'Domingo',         hours: 'Encerrado' },
              ].map(({ days, hours }) => (
                <li key={days} className="flex justify-between text-sm gap-4">
                  <span>{days}</span>
                  <span className="text-white font-medium">{hours}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/5 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center
                        justify-between gap-3 text-xs text-gray-600">
          <p>© {year} {barberShopConfig.name}. Todos os direitos reservados.</p>
          <div className="flex items-center gap-4">
            <a href="/infos/privacy" className="hover:text-gray-400 transition-colors">
              Política de Privacidade
            </a>
            <a href="/infos/booking-conditions" className="hover:text-gray-400 transition-colors">
              Condições de Reserva
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
