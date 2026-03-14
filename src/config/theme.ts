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
  logoUrl:     'https://pub-394b18eed1e94fcd86f2d647e456f996.r2.dev/logo.png',
  faviconUrl:  'https://pub-394b18eed1e94fcd86f2d647e456f996.r2.dev/favicon.png',

  // Título e descrição para <title> e meta description
  siteTitle:       'Brooklyn Barbearia — Reservas Online',
  siteDescription: 'Barbearia premium no Porto. Reserva online rápida e fácil.',

  // Horário
  workingHours: {
    monday:    { open: '10:00', close: '20:00', closed: false },
    tuesday:   { open: '10:00', close: '20:00', closed: false },
    wednesday: { open: '10:00', close: '20:00', closed: false },
    thursday:  { open: '10:00', close: '20:00', closed: false },
    friday:    { open: '10:00', close: '20:00', closed: false },
    saturday:  { open: '09:00', close: '18:00', closed: false },
    sunday:    { open: '00:00', close: '00:00', closed: true  },
  },

  // Duração padrão dos slots (minutos) — usado no agendamento
  slotDuration: 30,
} as const

/**
 * TEMA DE CORES
 *
 * primary  → verde escuro (cor de acção/botões)
 * secondary → champanhe/dourado (destaques, badges, preços)
 *
 * Ambas as paletas são usadas nas variáveis CSS em globals.css.
 * Para mudar a identidade visual da barbearia basta alterar estes valores.
 */
export const themeConfig = {
  /** Cor primária — tons de verde */
  primary: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#16a34a',  // botões, links activos
    600: '#15803d',
    700: '#166534',
    800: '#14532d',
    900: '#052e16',
  },
  /** Cor secundária — tons de champanhe/dourado */
  secondary: {
    50:  '#fefdf7',
    100: '#fdf9e7',
    200: '#faf0c2',
    300: '#f5e08a',
    400: '#ecc94b',
    500: '#d4a017',  // preços, badges, destaques
    600: '#b8860b',
    700: '#956c09',
    800: '#6b4d07',
    900: '#3d2c04',
  },
  sidebar: {
    bg:         '#111827',
    text:       '#9ca3af',
    textActive: '#ffffff',
    accent:     '#d4a017',
  },
  adminBg: '#f9fafb',
} as const
