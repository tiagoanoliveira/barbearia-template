import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { ROUTES } from '@/config/routes'
import { useAdminMe } from '@/hooks/useAdminUser'

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  '/admin/dashboard':          { title: 'Dashboard',          subtitle: 'Visão geral do negócio' },
  '/admin/calendario':         { title: 'Calendário',         subtitle: 'Reservas por dia' },
  '/admin/reservas':           { title: 'Reservas',           subtitle: 'Todas as marcações' },
  '/admin/clientes':           { title: 'Clientes',           subtitle: 'Base de clientes' },
  '/admin/indisponibilidades': { title: 'Indisponibilidades', subtitle: 'Gestão de folgas e ausências' },
  '/admin/configuracao':       { title: 'Configuração',       subtitle: 'Serviços, barbeiros, utilizadores e site' },
  '/admin/pagamentos':         { title: 'Pagamentos',         subtitle: 'Estatísticas e resumo financeiro' },
}

export default function AdminLayout() {
  const location = useLocation()
  const token = localStorage.getItem('admin_token')

  const [mobileOpen,      setMobileOpen]      = useState(false)
  const [desktopExpanded, setDesktopExpanded] = useState(false)

  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  // Sem token → login imediato, sem chamar /me
  if (!token) return <Navigate to={ROUTES.ADMIN_LOGIN} replace />

  // Busca o role REAL ao servidor — não confia no localStorage
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { adminUser, isLoading, isError } = useAdminMe()

  // Enquanto valida, não mostra nada (evita flash de conteúdo protegido)
  if (isLoading) return null

  // Se o backend rejeitou o token (401), o client.ts já limpou o token
  // e redirecciona para /admin/login. Este fallback garante o redirect
  // caso o localStorage ainda tenha o token antes de ser limpo.
  if (isError || !adminUser) return <Navigate to={ROUTES.ADMIN_LOGIN} replace />

  const isBarber = adminUser.role === 'barbeiro'
  const isSA     = adminUser.role === 'superAdmin'

  // Barbeiros não acedem a clientes nem a configuração
  if (isBarber && (
    location.pathname === ROUTES.ADMIN_CLIENTS ||
    location.pathname.startsWith('/admin/clientes/') ||
    location.pathname === ROUTES.ADMIN_SETTINGS
  )) {
    return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
  }

  // Apenas superAdmin acede a configuração e pagamentos
  if (!isSA && (
    location.pathname === ROUTES.ADMIN_SETTINGS ||
    location.pathname === ROUTES.ADMIN_PAYMENTS
  )) {
    return <Navigate to={ROUTES.ADMIN_DASHBOARD} replace />
  }

  const pageInfo = pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/clientes/')
      ? { title: 'Detalhe do Cliente' }
      : { title: 'Admin' })

  return (
    <div className="admin-root min-h-screen bg-[var(--surface-subtle)]">
      <Sidebar
        open={mobileOpen}
        expanded={desktopExpanded}
        onToggle={() => setMobileOpen(o => !o)}
        onExpand={() => setDesktopExpanded(e => !e)}
      />
      <div className="flex flex-col min-h-screen transition-all duration-300">
        <div className="admin-main-wrap flex flex-col min-h-screen transition-all duration-300 lg:ml-14">
          <Header
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            sidebarOpen={mobileOpen}
            onToggleSidebar={() => setMobileOpen(o => !o)}
          />
          <main className="flex-1 p-2 overflow-auto" style={{ marginTop: 'var(--header-height)' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
