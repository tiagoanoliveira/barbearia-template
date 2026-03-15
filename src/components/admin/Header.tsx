import { Menu } from 'lucide-react'
import { useLocation } from 'react-router-dom'

interface HeaderProps {
  title: string
  subtitle?: string
  onToggleSidebar?: () => void
}

export default function Header({ title, subtitle, onToggleSidebar }: HeaderProps) {
  const location = useLocation()

  return (
    <header
      className="fixed top-0 right-0 left-0 lg:left-[var(--sidebar-width)] bg-[var(--surface-elevated)] border-b border-[var(--border-subtle)] z-20"
      style={{ height: 'var(--header-height)' }}
    >
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="lg:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={onToggleSidebar}
          >
            <Menu size={18} className="text-gray-700" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500">
          <span>{location.pathname}</span>
        </div>
      </div>
    </header>
  )
}
