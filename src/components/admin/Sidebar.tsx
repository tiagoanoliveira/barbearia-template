import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  ClipboardList,
  Users,
  CalendarOff,
  Scissors,
  LogOut,
  ChevronRight,
} from 'lucide-react'
import { ROUTES } from '@/config/routes'
import { barberShopConfig } from '@/config/theme'
import { authApi } from '@/api/auth'

const navItems = [
  { to: ROUTES.ADMIN_DASHBOARD,    label: 'Dashboard',          icon: LayoutDashboard },
  { to: ROUTES.ADMIN_CALENDAR,     label: 'Calendário',         icon: CalendarDays },
  { to: ROUTES.ADMIN_RESERVATIONS, label: 'Reservas',           icon: ClipboardList },
  { to: ROUTES.ADMIN_CLIENTS,      label: 'Clientes',           icon: Users },
  { to: ROUTES.ADMIN_UNAVAILABLE,  label: 'Indisponibilidades', icon: CalendarOff },
]

export default function Sidebar() {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authApi.logout()
    localStorage.removeItem('admin_token')
    navigate(ROUTES.ADMIN_LOGIN)
  }

  return (
    <aside className="
      fixed top-0 left-0 h-full z-30
      flex flex-col
      bg-gray-900 text-gray-400
      transition-all duration-300
    " style={{ width: 'var(--sidebar-width)' }}>

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="flex-shrink-0 w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
          <Scissors size={18} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-semibold text-sm truncate leading-tight">
            {barberShopConfig.name}
          </p>
          <p className="text-gray-500 text-xs">Painel Admin</p>
        </div>
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
  )
}
