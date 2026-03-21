import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'

interface HeaderProps {
  title: string
  subtitle?: string
  sidebarOpen?: boolean
  onToggleSidebar?: () => void
}

export default function Header({ title, subtitle, sidebarOpen, onToggleSidebar }: HeaderProps) {
  return (
    <header
      className="fixed top-0 right-0 bg-[var(--surface-elevated)] border-b border-[var(--border-subtle)] z-20 transition-all duration-300"
      style={{
        height: 'var(--header-height)',
        // O header começa logo após a sidebar em desktop quando esta está aberta
        left: 0,
      }}
    >
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
            onClick={onToggleSidebar}
            title={sidebarOpen ? 'Fechar menu' : 'Abrir menu'}
          >
            {sidebarOpen
              ? <PanelLeftClose size={18} className="text-gray-700" />
              : <PanelLeftOpen  size={18} className="text-gray-700" />}
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
