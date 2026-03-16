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

export default function AdminLayout() {
  const location = useLocation()
  const token = localStorage.getItem('admin_token')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    // Desktop: abrir por omissão; mobile: fechado
    const handleResize = () => setSidebarOpen(window.innerWidth >= 1024)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  if (!token) {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  const pageInfo = pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/clientes/')
      ? { title: 'Detalhe do Cliente' }
      : { title: 'Admin' })

  return (
    <div className="min-h-screen bg-[var(--surface-subtle)] flex">
      <Sidebar open={sidebarOpen} onToggle={() => setSidebarOpen(o => !o)} />

      {/* Conteúdo principal — em desktop empurrado pela sidebar; em mobile ocupa tudo */}
      <div
        className="flex flex-col flex-1 min-h-screen transition-all duration-300"
        style={{ marginLeft: sidebarOpen ? 'var(--sidebar-width)' : 0 }}
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
