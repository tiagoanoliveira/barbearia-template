import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { Scissors, Menu, X, User } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'
import { ROUTES } from '@/config/routes'

const navLinks = [
  { to: ROUTES.HOME,     label: 'Início',   hash: '' },
  { to: '/#servicos',    label: 'Serviços', hash: 'servicos' },
  { to: '/#equipa',      label: 'Equipa',   hash: 'equipa' },
  { to: '/#galeria',     label: 'Galeria',  hash: 'galeria' },
  { to: '/#contacto',    label: 'Contacto', hash: 'contacto' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Fechar menu mobile ao navegar
  useEffect(() => setOpen(false), [location])

  const isHome = location.pathname === '/'
  const transparent = isHome && !scrolled && !open

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        transparent
          ? 'bg-transparent'
          : 'bg-gray-950/95 backdrop-blur-md border-b border-white/5'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center
                            group-hover:bg-brand-600 transition-colors">
              <Scissors size={17} className="text-white" />
            </div>
            <span className="text-white font-bold text-sm tracking-wide">
              {barberShopConfig.name}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <a
                key={to}
                href={to}
                className="px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg
                           hover:bg-white/5 transition-all"
              >
                {label}
              </a>
            ))}
          </nav>

          {/* CTA + user */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to={ROUTES.BOOKING}
              className="px-4 py-2 bg-brand-500 text-white text-sm font-semibold
                         rounded-xl hover:bg-brand-600 transition-colors"
            >
              Reservar
            </Link>
            <Link
              to="/perfil"
              className="p-2 rounded-xl text-gray-400 hover:text-white
                         hover:bg-white/5 transition-all"
            >
              <User size={18} />
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
            onClick={() => setOpen(o => !o)}
            aria-label="Menu"
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden bg-gray-950 border-t border-white/5 px-4 py-4 space-y-1">
          {navLinks.map(({ to, label }) => (
            <a
              key={to}
              href={to}
              className="block px-4 py-3 text-gray-300 hover:text-white
                         hover:bg-white/5 rounded-xl transition-all text-sm"
            >
              {label}
            </a>
          ))}
          <div className="pt-3 border-t border-white/5 mt-3 flex flex-col gap-2">
            <Link
              to="/perfil"
              className="flex items-center gap-2 px-4 py-3 text-gray-300 text-sm
                         hover:bg-white/5 rounded-xl"
            >
              <User size={16} /> A minha conta
            </Link>
            <Link
              to={ROUTES.BOOKING}
              className="flex items-center justify-center py-3 bg-brand-500
                         text-white font-semibold rounded-xl text-sm"
            >
              Reservar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
