export const ROUTES = {
  // Público
  HOME: '/',
  SERVICES: '/servicos',
  CONTACT: '/contacto',
  BOOKING: '/reservar',

  // Admin
  ADMIN: '/admin',
  ADMIN_DASHBOARD: '/admin/dashboard',
  ADMIN_CALENDAR: '/admin/calendario',
  ADMIN_RESERVATIONS: '/admin/reservas',
  ADMIN_CLIENTS: '/admin/clientes',
  ADMIN_CLIENT_DETAIL: '/admin/clientes/:id',
  ADMIN_UNAVAILABLE: '/admin/indisponibilidades',
  ADMIN_LOGIN: '/admin/login',
} as const
