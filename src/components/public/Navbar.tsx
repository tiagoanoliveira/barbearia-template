import { useState, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Scissors, Menu, X, User, LogIn } from 'lucide-react'
import { barberShopConfig, LOGO_URL } from '@/config/theme'
import { ROUTES } from '@/config/routes'

const navLinks = [
  { to: ROUTES.HOME,  label: 'Início'   },
  { to: '/#servicos', label: 'Serviços' },
  { to: '/#equipa',   label: 'Equipa'   },
  { to: '/#galeria',  label: 'Galeria'  },
]

function getProfilePicture(): string | null {
  try {
    const token = localStorage.getItem('user_token')
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload?.picture ?? null
  } catch { return null }
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem('user_token')
}

export default function Navbar() {
  const [open, setOpen]         = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  useEffect(() => setOpen(false), [location])

  const isHome      = location.pathname === '/'
  const transparent = isHome && !scrolled && !open
  const loggedIn    = isLoggedIn()
  const picture     = getProfilePicture()

  const handleProfile = () =>
    loggedIn ? navigate('/perfil') : navigate('/login?redirect=/perfil')

  const LogoMark = () => (
    LOGO_URL
      ? <img src={LOGO_URL} alt={barberShopConfig.name}
             className="w-8 h-8 object-contain" />
      : <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
          <Scissors size={16} className="text-white" />
        </div>
  )

  const ProfileButton = ({ mobile = false }: { mobile?: boolean }) => {
    if (loggedIn) {
      return (
        <button onClick={handleProfile} aria-label="O meu perfil"
          className={mobile
            ? 'flex items-center gap-2 px-4 py-3 text-gray-300 text-sm hover:bg-white/5 rounded-xl w-full text-left'
            : 'p-1.5 rounded-xl hover:bg-white/5 transition-all'
          }>
          {picture
            ? <img src={picture} alt="perfil" className="w-7 h-7 rounded-full object-cover ring-2 ring-primary-500" />
            : <div className="w-7 h-7 rounded-full bg-primary-500/20 border border-primary-500/50 flex items-center justify-center">
                <User size={14} className="text-primary-400" />
              </div>
          }
          {mobile && <span>O meu perfil</span>}
        </button>
      )
    }
    return (
      <button onClick={handleProfile} aria-label="Entrar"
        className={mobile
          ? 'flex items-center gap-2 px-4 py-3 text-gray-300 text-sm hover:bg-white/5 rounded-xl w-full text-left'
          : 'flex items-center gap-1.5 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all'
        }>
        <LogIn size={15} />
        {mobile ? 'Entrar / Registar' : 'Entrar'}
      </button>
    )
  }

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      transparent ? 'bg-transparent' : `${barberShopConfig.theme.navbarBg} border-b ${barberShopConfig.theme.navbarBorder}`
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">

          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group">
            <LogoMark />
            <span className="text-white font-bold text-sm tracking-wide">{barberShopConfig.name}</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <a key={to} href={to} className="px-3 py-2 text-sm text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-all">
                {label}
              </a>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Link to={ROUTES.BOOKING} className="px-4 py-2 bg-primary-500 text-white text-sm font-semibold rounded-xl hover:bg-primary-600 transition-colors">
              Reservar
            </Link>
            <ProfileButton />
          </div>

          <button className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                  onClick={() => setOpen(o => !o)} aria-label="Menu">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className={`md:hidden ${barberShopConfig.theme.navbarBg} border-t ${barberShopConfig.theme.navbarBorder} px-4 py-4 space-y-1`}>
          {navLinks.map(({ to, label }) => (
            <a key={to} href={to} className="block px-4 py-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl transition-all text-sm">
              {label}
            </a>
          ))}
          <div className="pt-3 border-t border-white/5 mt-3 flex flex-col gap-2">
            <ProfileButton mobile />
            <Link to={ROUTES.BOOKING} className="flex items-center justify-center py-3 bg-primary-500 text-white font-semibold rounded-xl text-sm">
              Reservar agora
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
