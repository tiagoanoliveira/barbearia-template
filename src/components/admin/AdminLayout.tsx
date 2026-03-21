import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { ROUTES } from '@/config/routes'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/admin/dashboard':          { title: 'Dashboard',          subtitle: 'Visão geral do negócio' },
  '/admin/calendario':         { title: 'Calendário',         subtitle: 'Reservas por dia' },
  '/admin/reservas':           { title: 'Reservas',           subtitle: 'Todas as marcações' },
  '/admin/clientes':           { title: 'Clientes',           subtitle: 'Base de clientes' },
  '/admin/indisponibilidades': { title: 'Indisponibilidades', subtitle: 'Gestão de folgas e ausências' },
  '/admin/configuracao':       { title: 'Configuração',       subtitle: 'Serviços, barbeiros, utilizadores e site' },
}

// Em desktop (lg+) a sidebar ocupa var(--sidebar-width).
// Em mobile a sidebar flutua por cima (backdrop), por isso marginLeft = 0.

export default function AdminLayout() {
  const location = useLocation()
  const token = localStorage.getItem('admin_token')
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024)

  // Fecha ao navegar em mobile
  useEffect(() => {
    if (window.innerWidth < 1024) setSidebarOpen(false)
  }, [location.pathname])

  if (!token) {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  const pageInfo = pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/clientes/')
      ? { title: 'Detalhe do Cliente' }
      : { title: 'Admin' })

  return (
    <div className="admin-root min-h-screen bg-[var(--surface-subtle)]">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />

      {/*
        Em desktop (lg), o content deve ficar deslocado `--sidebar-width` à direita.
        Em mobile a sidebar flutua, por isso não há deslocamento.
      */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen && window.innerWidth >= 1024 ? 'var(--sidebar-width)' : 0 }}
      >
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(o => !o)}
        />
        <main
          className="flex-1 p-4 overflow-auto"
          style={{ marginTop: 'var(--header-height)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
