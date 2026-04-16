import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, CalendarDays, ClipboardList, Users,
  CalendarOff, Scissors, LogOut, ChevronRight, Settings,
  X, PanelLeftClose, PanelLeftOpen,
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
    ? <img src={LOGO_URL} alt={barberShopConfig.name} className="w-8 h-8 object-contain flex-shrink-0" />
    : <div className="w-8 h-8 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
        <Scissors size={16} className="text-white" />
      </div>
)

interface SidebarProps {
  /** true  = sidebar visível (mobile slide-in ou desktop expanded)
   *  false = sidebar oculta (mobile) ou colapsada em mini-icons (desktop) */
  open: boolean
  /** desktop: true = texto visível, false = apenas ícones */
  expanded: boolean
  onToggle:   () => void   // mobile open/close
  onExpand:   () => void   // desktop expand/collapse
}

export default function Sidebar({ open, expanded, onToggle, onExpand }: SidebarProps) {
  const navigate = useNavigate()

  const handleLogout = async () => {
    await authApi.logout()
    localStorage.removeItem('admin_token')
    navigate(ROUTES.ADMIN_LOGIN)
  }

  return (
    <>
      {/* Backdrop mobile */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={onToggle} />
      )}

      {/* ── Sidebar mobile (slide-in/out) ── */}
      <aside
        className={`
          fixed top-0 left-0 h-full z-40 flex flex-col
          bg-gray-900 text-gray-400 transition-transform duration-300
          lg:hidden
          ${open ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{ width: 'var(--sidebar-width)' }}
      >
        <SidebarContent expanded={true} onItemClick={onToggle} onExpand={onToggle} onLogout={handleLogout} showClose />
      </aside>

      {/* ── Sidebar desktop (sempre visível, alterna entre expanded e mini) ── */}
      <aside
        className="hidden lg:flex flex-col fixed top-0 left-0 h-full z-40 bg-gray-900 text-gray-400 transition-all duration-300"
        style={{ width: expanded ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)' }}
      >
        <SidebarContent expanded={expanded} onItemClick={() => {}} onExpand={onExpand} onLogout={handleLogout} showClose={false} />
      </aside>
    </>
  )
}

// ─── Conteúdo partilhado ────────────────────────────────────────────────────
function SidebarContent({ expanded, onItemClick, onExpand, onLogout, showClose }: {
  expanded: boolean
  onItemClick: () => void
  onExpand: () => void
  onLogout: () => void
  showClose: boolean
}) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className={`flex items-center border-b border-gray-800 transition-all duration-300 ${
        expanded ? 'gap-3 px-4 py-5' : 'justify-center px-0 py-4'
      }`}>
        <Link to={ROUTES.ADMIN} className="flex items-center gap-2.5 group flex-shrink-0">
          <LogoMark />
        </Link>
        {expanded && (
          <div className="min-w-0 flex-1">
            <p className="text-white font-semibold text-sm truncate leading-tight">{barberShopConfig.name}</p>
            <p className="text-gray-500 text-xs">Painel Admin</p>
          </div>
        )}
        {showClose && (
          <button className="ml-2 p-1.5 rounded-lg hover:bg-gray-800" onClick={onExpand}>
            <X size={16} className="text-gray-400" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-1 overflow-y-auto overflow-x-hidden">
        {expanded && (
          <p className="px-4 mb-2 text-xs font-semibold uppercase tracking-wider text-gray-600">Menu</p>
        )}
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            title={!expanded ? label : undefined}
            className={({ isActive }) =>
              `group flex items-center transition-all duration-150 ${
                expanded ? 'gap-3 mx-2 px-3 py-2.5' : 'justify-center mx-1 px-0 py-3'
              } rounded-xl text-sm font-medium ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400'
                  : 'hover:bg-gray-800 hover:text-gray-200'
              }`
            }
            onClick={onItemClick}
          >
            {({ isActive }) => (
              <>
                <Icon
                  size={18}
                  className={`flex-shrink-0 transition-colors ${
                    isActive ? 'text-brand-400' : 'text-gray-500 group-hover:text-gray-300'
                  }`}
                />
                {expanded && <span className="flex-1 truncate">{label}</span>}
                {expanded && isActive && <ChevronRight size={14} className="text-brand-400 flex-shrink-0" />}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="py-3 border-t border-gray-800">
        {/* Botão toggle desktop expand/collapse */}
        <button
          onClick={onExpand}
          title={expanded ? 'Colapsar menu' : 'Expandir menu'}
          className={`w-full flex items-center transition-all duration-150 hover:bg-gray-800 hover:text-gray-200 rounded-xl text-gray-500 ${
            expanded ? 'gap-3 mx-0 px-5 py-2.5' : 'justify-center mx-1 px-0 py-3'
          }`}
        >
          {expanded
            ? <><PanelLeftClose size={18} className="flex-shrink-0" /><span className="text-sm font-medium">Colapsar menu</span></>
            : <PanelLeftOpen size={18} className="flex-shrink-0" />
          }
        </button>
        <button
          onClick={onLogout}
          className={`w-full flex items-center transition-all duration-150 hover:bg-gray-800 hover:text-red-400 rounded-xl text-gray-500 ${
            expanded ? 'gap-3 mx-0 px-5 py-2.5' : 'justify-center mx-1 px-0 py-3'
          }`}
          title={!expanded ? 'Terminar sessão' : undefined}
        >
          <LogOut size={18} className="flex-shrink-0" />
          {expanded && <span className="text-sm font-medium">Terminar sessão</span>}
        </button>
      </div>
    </div>
  )
}
