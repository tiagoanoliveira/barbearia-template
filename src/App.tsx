import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'

// Layouts
import AdminLayout from '@/components/admin/AdminLayout'
import PublicLayout from '@/components/public/PublicLayout'

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
import BookingPage from '@/pages/public/BookingPage'
import ProfilePage from '@/pages/public/ProfilePage'
import ReservationsPublicPage from '@/pages/public/ReservationsPublicPage'
import PublicLoginPage from '@/pages/public/PublicLoginPage'
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'

// Legal & support pages
import FaqPage from '@/pages/public/FaqPage'
import PrivacyPage from '@/pages/public/PrivacyPage'
import CookiesPage from '@/pages/public/CookiesPage'
import TermsPage from '@/pages/public/TermsPage'
import BookingConditionsPage from '@/pages/public/BookingConditionsPage'
import SupportPage from '@/pages/public/SupportPage'

export default function App() {
  return (
    <Routes>
      {/* OAuth callback — fora do PublicLayout para não ter Navbar/Footer */}
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Público */}
      <Route element={<PublicLayout />}>
        <Route path={ROUTES.HOME}         element={<HomePage />} />
        <Route path="/reservar"           element={<BookingPage />} />
        <Route path="/perfil"             element={<ProfilePage />} />
        <Route path="/reservations"       element={<ReservationsPublicPage />} />
        <Route path="/login"              element={<PublicLoginPage />} />

        {/* Legal */}
        <Route path="/faq"                element={<FaqPage />} />
        <Route path="/privacidade"        element={<PrivacyPage />} />
        <Route path="/cookies"            element={<CookiesPage />} />
        <Route path="/termos"             element={<TermsPage />} />
        <Route path="/condicoes-reserva"  element={<BookingConditionsPage />} />
        <Route path="/suporte"            element={<SupportPage />} />
      </Route>

      {/* Admin auth */}
      <Route path={ROUTES.ADMIN_LOGIN} element={<LoginPage />} />

      {/* Admin (layout com sidebar) */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
        <Route path="dashboard"          element={<DashboardPage />} />
        <Route path="calendario"         element={<CalendarPage />} />
        <Route path="reservas"           element={<ReservationsPage />} />
        <Route path="clientes"           element={<ClientsPage />} />
        <Route path="clientes/:id"       element={<ClientDetailPage />} />
        <Route path="indisponibilidades" element={<UnavailablePage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
    </Routes>
  )
}
