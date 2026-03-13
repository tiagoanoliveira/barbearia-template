import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'

// Layouts
import AdminLayout from '@/components/admin/AdminLayout'

// Admin pages
import DashboardPage from '@/pages/admin/DashboardPage'
import CalendarPage from '@/pages/admin/CalendarPage'
import ReservationsPage from '@/pages/admin/ReservationsPage'
import ClientsPage from '@/pages/admin/ClientsPage'
import ClientDetailPage from '@/pages/admin/ClientDetailPage'
import UnavailablePage from '@/pages/admin/UnavailablePage'
import LoginPage from '@/pages/admin/LoginPage'

// Public pages
import HomePage from '@/pages/public/HomePage'

export default function App() {
  return (
    <Routes>
      {/* Público */}
      <Route path={ROUTES.HOME} element={<HomePage />} />

      {/* Auth */}
      <Route path={ROUTES.ADMIN_LOGIN} element={<LoginPage />} />

      {/* Admin (layout com sidebar) */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="calendario" element={<CalendarPage />} />
        <Route path="reservas" element={<ReservationsPage />} />
        <Route path="clientes" element={<ClientsPage />} />
        <Route path="clientes/:id" element={<ClientDetailPage />} />
        <Route path="indisponibilidades" element={<UnavailablePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  )
}
