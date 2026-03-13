import { Bell, Menu } from 'lucide-react'
import { barberShopConfig } from '@/config/theme'

interface HeaderProps {
  title: string
  subtitle?: string
  onMenuToggle?: () => void
}

export default function Header({ title, subtitle, onMenuToggle }: HeaderProps) {
  const user = JSON.parse(localStorage.getItem('admin_user') ?? '{}')
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'A'

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center justify-between
                 bg-white border-b border-gray-100 px-6"
      style={{
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <Menu size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-base font-semibold text-gray-900 leading-tight">{title}</h1>
          {subtitle && (
            <p className="text-xs text-gray-500">{subtitle}</p>
          )}
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        {/* Notificações */}
        <button className="relative p-2 rounded-xl hover:bg-gray-100 transition-colors">
          <Bell size={20} className="text-gray-600" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-brand-500 rounded-full" />
        </button>

        {/* User */}
        <div className="flex items-center gap-2.5 pl-3 border-l border-gray-100">
          <div className="w-8 h-8 bg-brand-500 rounded-xl flex items-center justify-center">
            <span className="text-white text-xs font-semibold">{initials}</span>
          </div>
          <div className="hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">
              {user?.name ?? 'Admin'}
            </p>
            <p className="text-xs text-gray-500">{barberShopConfig.name}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
