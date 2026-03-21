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

  // mobile: sidebar aberta/fechada
  const [mobileOpen, setMobileOpen] = useState(false)
  // desktop: sidebar expandida (texto) ou colapsada (mini-icons) — por defeito colapsada
  const [desktopExpanded, setDesktopExpanded] = useState(false)

  // Fecha o mobile ao navegar
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  if (!token) return <Navigate to={ROUTES.ADMIN_LOGIN} replace />

  const pageInfo = pageTitles[location.pathname] ??
    (location.pathname.startsWith('/admin/clientes/')
      ? { title: 'Detalhe do Cliente' }
      : { title: 'Admin' })

  // Largura efectiva da sidebar para empurrar o conteúdo em desktop
  const sidebarW = desktopExpanded ? 'var(--sidebar-width)' : 'var(--sidebar-collapsed-width)'

  return (
    <div className="admin-root min-h-screen bg-[var(--surface-subtle)]">
      <Sidebar
        open={mobileOpen}
        expanded={desktopExpanded}
        onToggle={() => setMobileOpen(o => !o)}
        onExpand={() => setDesktopExpanded(e => !e)}
      />

      {/* Conteúdo principal — em desktop desloca-se com a sidebar */}
      <div
        className="flex flex-col min-h-screen transition-all duration-300"
        style={{ marginLeft: `var(--sidebar-collapsed-width)` }}
        // Em desktop usamos sempre a largura efectiva via CSS; marginLeft base é o mini
      >
        {/* Nos ecrãs lg+ ajustamos via inline-style para reagir à expansão */}
        <style>{`@media(min-width:1024px){.admin-main-wrap{margin-left:${sidebarW}!important}}`}</style>
        <div className="admin-main-wrap flex flex-col min-h-screen transition-all duration-300">
          <Header
            title={pageInfo.title}
            subtitle={pageInfo.subtitle}
            sidebarOpen={mobileOpen}
            onToggleSidebar={() => setMobileOpen(o => !o)}
          />
          <main className="flex-1 p-4 overflow-auto" style={{ marginTop: 'var(--header-height)' }}>
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
