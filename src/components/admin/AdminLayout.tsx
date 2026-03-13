import { Outlet, useLocation, Navigate } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { ROUTES } from '@/config/routes'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/admin/dashboard':          { title: 'Dashboard',          subtitle: 'Visão geral do negócio' },
  '/admin/calendario':         { title: 'Calendário',         subtitle: 'Reservas por dia' },
  '/admin/reservas':           { title: 'Reservas',           subtitle: 'Todas as marcações' },
  '/admin/clientes':           { title: 'Clientes',           subtitle: 'Base de clientes' },
  '/admin/indisponibilidades': { title: 'Indisponibilidades', subtitle: 'Gestão de folgas e ausências' },
}

export default function AdminLayout() {
  const location = useLocation()
  const token = localStorage.getItem('admin_token')

  if (!token) {
    return <Navigate to={ROUTES.ADMIN_LOGIN} replace />
  }

  const pageInfo = pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/clientes/')
      ? { title: 'Detalhe do Cliente' }
      : { title: 'Admin' })

  return (
    // admin-root força variáveis CSS light mesmo em dispositivos com dark mode
    <div className="admin-root min-h-screen bg-[var(--surface-subtle)]">
      <Sidebar />
      <div
        className="flex flex-col min-h-screen"
        style={{ marginLeft: 'var(--sidebar-width)' }}
      >
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main
          className="flex-1 p-6 overflow-auto"
          style={{ marginTop: 'var(--header-height)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
