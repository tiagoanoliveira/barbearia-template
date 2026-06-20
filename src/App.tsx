import { Routes, Route, Navigate } from 'react-router-dom'
import { ROUTES } from '@/config/routes'
import ScrollToTop from '@/components/ScrollToTop'

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
import ConfiguracaoPage from '@/pages/admin/ConfiguracaoPage'
import PagamentosPage from '@/pages/admin/PagamentosPage'
import DiscountsPage from '@/pages/admin/DiscountsPage'
import LoginPage from '@/pages/admin/LoginPage'
import AdminResetPasswordPage from '@/pages/admin/AdminResetPasswordPage'
import VendasProdutosPage from '@/pages/admin/VendasProdutosPage'
import HistoricoVendasPage from '@/pages/admin/HistoricoVendasPage'

// Public pages
import HomePage from '@/pages/public/HomePage'
import BookingPage from '@/pages/public/BookingPage'
import ProfilePage from '@/pages/public/ProfilePage'
import ReservationsPublicPage from '@/pages/public/ReservationsPublicPage'
import PublicLoginPage from '@/pages/public/PublicLoginPage'
import AuthCallbackPage from '@/pages/public/AuthCallbackPage'
import ForgotPasswordPage from '@/pages/public/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/public/ResetPasswordPage'

// Legal & support pages
import FaqPage from '@/pages/public/FaqPage'
import PrivacyPage from '@/pages/public/PrivacyPage'
import CookiesPage from '@/pages/public/CookiesPage'
import TermsPage from '@/pages/public/TermsPage'
import BookingConditionsPage from '@/pages/public/BookingConditionsPage'
import SupportPage from '@/pages/public/SupportPage'
import RalPage from '@/pages/public/RalPage'
import LegalNoticePage from '@/pages/public/LegalNoticePage'

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* OAuth callback */}
        <Route path="/auth/callback" element={<AuthCallbackPage />} />

        {/* Público */}
        <Route element={<PublicLayout />}>
          <Route path={ROUTES.HOME}         element={<HomePage />} />
          <Route path="/reservar"           element={<BookingPage />} />
          <Route path="/perfil"             element={<ProfilePage />} />
          <Route path="/reservations"       element={<ReservationsPublicPage />} />
          <Route path="/login"              element={<PublicLoginPage />} />
          <Route path="/esqueci-password"   element={<ForgotPasswordPage />} />
          <Route path="/recuperar-password" element={<ResetPasswordPage />} />

          {/* Legal */}
          <Route path="/faq"                element={<FaqPage />} />
          <Route path="/privacidade"        element={<PrivacyPage />} />
          <Route path="/cookies"            element={<CookiesPage />} />
          <Route path="/termos"             element={<TermsPage />} />
          <Route path="/condicoes-reserva"  element={<BookingConditionsPage />} />
          <Route path="/suporte"            element={<SupportPage />} />
          <Route path="/aviso-legal"        element={<LegalNoticePage />} />
          <Route path="/ral"                element={<RalPage />} />
        </Route>

        {/* Admin auth */}
        <Route path={ROUTES.ADMIN_LOGIN}           element={<LoginPage />} />
        <Route path={ROUTES.ADMIN_RESET_PASSWORD}  element={<AdminResetPasswordPage />} />

        {/* Admin (layout com sidebar) */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
          <Route path="dashboard"          element={<DashboardPage />} />
          <Route path="calendario"         element={<CalendarPage />} />
          <Route path="reservas"           element={<ReservationsPage />} />
          <Route path="clientes"           element={<ClientsPage />} />
          <Route path="clientes/:id"       element={<ClientDetailPage />} />
          <Route path="indisponibilidades" element={<UnavailablePage />} />
          <Route path="configuracao"       element={<ConfiguracaoPage />} />
          <Route path="pagamentos"         element={<PagamentosPage />} />
          <Route path="descontos"          element={<DiscountsPage />} />
          {/* Vendas de Produtos — admin e superAdmin */}
          <Route path="vendas-produtos"    element={<VendasProdutosPage />} />
          {/* Histórico de Vendas — apenas superAdmin (verificado dentro da página) */}
          <Route path="historico-vendas"   element={<HistoricoVendasPage />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.HOME} replace />} />
      </Routes>
    </>
  )
}
