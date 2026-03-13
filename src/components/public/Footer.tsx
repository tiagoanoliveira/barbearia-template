import { Link } from 'react-router-dom'
import { Scissors, Instagram, Phone, Mail, MapPin, Clock } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-gray-950 border-t border-white/5 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
                <Scissors size={17} className="text-white" />
              </div>
              <span className="text-white font-bold text-sm">{barberShopConfig.name}</span>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              {barberShopConfig.description}
            </p>
            <a href={barberShopConfig.instagram} target="_blank" rel="noreferrer"
               className="inline-flex items-center gap-2 mt-4 text-brand-400 hover:text-brand-300 text-sm transition-colors">
              <Instagram size={16} /> Instagram
            </a>
          </div>

          {/* Contacto */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Contacto</h4>
            <ul className="space-y-3 text-sm text-gray-500">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-brand-500 flex-shrink-0" />
                <a href={`tel:${barberShopConfig.phone}`} className="hover:text-gray-300 transition-colors">
                  {barberShopConfig.phone}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-brand-500 flex-shrink-0" />
                <a href={`mailto:${barberShopConfig.email}`} className="hover:text-gray-300 transition-colors">
                  {barberShopConfig.email}
                </a>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-brand-500 flex-shrink-0 mt-0.5" />
                <span>{barberShopConfig.address}</span>
              </li>
            </ul>
          </div>

          {/* Horário */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              <Clock size={14} className="inline mr-1.5 text-brand-500" />
              Horário
            </h4>
            <ul className="space-y-1.5 text-sm text-gray-500">
              {([
                ['Segunda', 'monday'],
                ['Terça',   'tuesday'],
                ['Quarta',  'wednesday'],
                ['Quinta',  'thursday'],
                ['Sexta',   'friday'],
                ['Sábado',  'saturday'],
                ['Domingo', 'sunday'],
              ] as const).map(([label, key]) => {
                const h = barberShopConfig.workingHours[key]
                return (
                  <li key={key} className="flex justify-between gap-4">
                    <span>{label}</span>
                    <span className={h.closed ? 'text-red-500' : 'text-gray-400'}>
                      {h.closed ? 'Fechado' : `${h.open} – ${h.close}`}
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>

          {/* Links legais */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Informações</h4>
            <ul className="space-y-2 text-sm">
              {[
                { to: '/faq',              label: 'Perguntas Frequentes' },
                { to: '/suporte',          label: 'Suporte & Ajuda' },
                { to: '/condicoes-reserva',label: 'Condições de Reserva' },
                { to: '/privacidade',      label: 'Política de Privacidade' },
                { to: '/cookies',          label: 'Política de Cookies' },
                { to: '/termos',           label: 'Termos e Condições' },
              ].map(({ to, label }) => (
                <li key={to}>
                  <Link to={to} className="text-gray-500 hover:text-gray-300 transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center
                        justify-between gap-3 text-xs text-gray-600">
          <span>© {year} {barberShopConfig.name}. Todos os direitos reservados.</span>
          <div className="flex items-center gap-4">
            <Link to="/privacidade" className="hover:text-gray-400 transition-colors">Privacidade</Link>
            <Link to="/termos" className="hover:text-gray-400 transition-colors">Termos</Link>
            <Link to="/cookies" className="hover:text-gray-400 transition-colors">Cookies</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
