import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  CalendarOff,
  Scissors,
  LogOut,
  ChevronRight,
  Settings,
  X,
} from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { barberShopConfig, LOGO_URL } from '@/config/theme'
import { authApi } from '@/api/auth'

const navItems = [
  { to: ROUTES.ADMIN_DASHBOARD,    label: 'Dashboard',          icon: LayoutDashboard },
  { to: ROUTES.ADMIN_CALENDAR,     label: 'Calendário',         icon: CalendarDays },
  { to: ROUTES.ADMIN_RESERVATIONS, label: 'Reservas',           icon: ClipboardList },
  { to: ROUTES.ADMIN_CLIENTS,      label: 'Clientes',           icon: Users },
  { to: ROUTES.ADMIN_UNAVAILABLE,  label: 'Indisponibilidades', icon: CalendarOff },
  { to: ROUTES.ADMIN_SETTINGS,     label: 'Configuração',       icon: Settings },
]

const LogoMark = () => (
  LOGO_URL
    ? <img src={LOGO_URL} alt={barberShopConfig.name} className="w-8 h-8 object-contain" />
    : <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center">
        <Scissors size={16} className="text-white" />
      </div>
)

interface SidebarProps {
  open: boolean
  onToggle: () => void
}

export default function Sidebar({ open, onToggle }: SidebarProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authApi.logout()
    localStorage.removeItem('admin_token')
    navigate(ROUTES.ADMIN_LOGIN)
  }

  return (
    <>
      {/* Backdrop — só em mobile quando aberta */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-40
          flex flex-col
          bg-gray-900 text-gray-400
          transition-transform duration-300
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: 'var(--sidebar-width)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
          <Link to={ROUTES.HOME} className="flex items-center gap-2.5 group">
            <LogoMark />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate leading-tight">
              {barberShopConfig.name}
            </p>
            <p className="text-gray-500 text-xs">Painel Admin</p>
          </div>
          {/* Botão fechar — visível em mobile */}
          <button
            className="lg:hidden ml-2 p-1.5 rounded-lg hover:bg-gray-800"
            onClick={onToggle}
          >
            <X size={16} className="text-gray-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <p className="px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">
            Menu
          </p>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'hover:bg-gray-800 hover:text-gray-200'
                }`
              }
              onClick={() => { if (window.innerWidth < 1024) onToggle() }}
            >
              {({ isActive }) => (
                <>
                  <Icon
                    size={18}
                    className={`flex-shrink-0 transition-colors ${
                      isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'
                    }`}
                  />
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <ChevronRight size={14} className="text-brand-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Footer — logout */}
        <div className="px-3 py-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                       text-gray-500 hover:bg-gray-800 hover:text-red-400 transition-all"
          >
            <LogOut size={18} className="flex-shrink-0" />
            Terminar sessão
          </button>
        </div>
      </aside>
    </>
  )
}
