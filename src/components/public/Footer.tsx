import { Link } from 'react-router-dom'
import { Scissors, Instagram, Phone, Mail, MapPin, Clock } from 'lucide-react'
import { barberShopConfig, groupWorkingHours, LOGO_URL } from '@/config/theme'
import { ROUTES } from '@/config/routes'

export default function Footer() {
  const year       = new Date().getFullYear()
  const hourGroups = groupWorkingHours()

  const LogoMark = () => (
    LOGO_URL
      ? <img src={LOGO_URL} alt={barberShopConfig.name} className="w-8 h-8 object-contain" />
      : <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
          <Scissors size={16} className="text-white" />
        </div>
  )

  return (
    <footer className="bg-gray-950 border-t border-white/5 pt-14 pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group">
                <LogoMark />
                <span className="text-white font-bold text-sm tracking-wide">{barberShopConfig.name}</span>
              </Link>
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

          {/* Horário — agrupado automaticamente */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">
              <Clock size={14} className="inline mr-1.5 text-brand-500" />
              Horário
            </h4>
            <ul className="space-y-1.5 text-sm text-gray-500">
              {hourGroups.map(g => (
                <li key={g.label} className="flex justify-between gap-4">
                  <span>{g.label}</span>
                  <span className={g.closed ? 'text-red-500' : 'text-gray-400'}>
                    {g.hours}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Links legais */}
          <div>
            <h4 className="text-white font-semibold text-sm mb-4">Informações</h4>
            <ul className="space-y-2 text-sm">
              {[
                { to: '/faq',               label: 'Perguntas Frequentes' },
                { to: '/suporte',           label: 'Suporte' },
                { to: '/condicoes-reserva', label: 'Condições de Reserva' },
                { to: '/privacidade',       label: 'Política de Privacidade' },
                { to: '/cookies',           label: 'Política de Cookies' },
                { to: '/termos',            label: 'Termos e Condições' },
                { to: '/aviso-legal',       label: 'Aviso Legal' },
                { to: '/ral',               label: 'Reclamações' },
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
            <span>Website feito com 🤍 por <a href="https://www.tiagoanoliveira.pt">Tiago Oliveira</a>.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
