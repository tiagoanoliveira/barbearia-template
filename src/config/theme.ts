/**
 * CONFIGURAÇÃO DA BARBEARIA
 * Para cada nova barbearia, editar apenas este ficheiro.
 */
export const barberShopConfig = {
  // Identidade
  name:        'Brooklyn Barbearia',
  tagline:     'Tradição e estilo em cada corte',
  description: 'Barbearia premium no coração da cidade. Cortes clássicos e modernos.',
  phone:       '+351 912 345 678',
  email:       'info@brooklynbarbearia.pt',
  address:     'Rua Exemplo, 123, Porto',
  instagram:   'https://instagram.com/brooklynbarbearia',

  // ─ Branding visual ─────────────────────────────────────────────
  // Coloca a URL do R2 (ou /public/...) quando tiveres os ficheiros.
  // null = usa o icóne de tesoura como fallback.
  logoUrl:     null as string | null,   // ex: 'https://pub-xxx.r2.dev/logo.png'
  faviconUrl:  null as string | null,   // ex: 'https://pub-xxx.r2.dev/favicon.png'

  // Título e descrição para <title> e meta description
  siteTitle:       'Brooklyn Barbearia — Reservas Online',
  siteDescription: 'Barbearia premium no Porto. Reserva online rápida e fácil.',

  // Horário
  workingHours: {
    monday:    { open: '09:00', close: '19:00', closed: false },
    tuesday:   { open: '09:00', close: '19:00', closed: false },
    wednesday: { open: '09:00', close: '19:00', closed: false },
    thursday:  { open: '09:00', close: '20:00', closed: false },
    friday:    { open: '09:00', close: '20:00', closed: false },
    saturday:  { open: '09:00', close: '18:00', closed: false },
    sunday:    { open: '00:00', close: '00:00', closed: true  },
  },

  // Duração padrão dos slots (minutos)
  slotDuration: 30,
} as const

/**
 * TEMA DE CORES
 */
export const themeConfig = {
  brand: {
    50:  '#fefdf7',
    100: '#fdf9e7',
    200: '#faf0c2',
    300: '#f5e08a',
    400: '#ecc94b',
    500: '#d4a017',
    600: '#b8860b',
    700: '#956c09',
    800: '#6b4d07',
    900: '#3d2c04',
  },
  sidebar: {
    bg:          '#111827',
    text:        '#9ca3af',
    textActive:  '#ffffff',
    accent:      '#d4a017',
  },
  adminBg: '#f9fafb',
} as const
