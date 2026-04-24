/**
 * CONFIGURAÇÃO DA BARBEARIA
 * Para cada nova barbearia, editar apenas este ficheiro.
 */

// ─ Logos / Favicon (servidos do repositório via BASE_URL) ─────────────────
import logoSrc    from '@/media/images/logos/logo-512px.png'
import faviconSrc from '@/media/images/logos/logo-96px.png'

export const LOGO_URL    = logoSrc
export const FAVICON_URL = faviconSrc

export const barberShopConfig = {
  // Identidade
  name:        'Brooklyn Barbearia',
  tagline:     'Tradição e estilo em cada corte',
  description: 'Barbearia premium no coração da cidade. Cortes clássicos e modernos.',
  phone:       '+351 224 938 542',
  email:       'geral@brooklynbarbearia.pt',
  address:     'Rua do Campo Alegre, 450, Porto',
  instagram:   'https://instagram.com/brooklynbarbearia',
  supportIframeSrc: 'https://tiagoanoliveira.pt/support/988b8a8a745c445fbaff596ad5be54dd',
  // Dados legais
  nif:           'PT 999 999 999',
  legalName:     'Brooklyn Barbearia, Lda.',
  legalForm:     'Sociedade por Quotas',
  comarca:       'Porto',
  ralName:       'Centro de Arbitragem de Conflitos de Consumo do Porto',
  ralAddress:    'Rua de Damião de Góis, 31, Loja 6, 4050-225 Porto',
  ralPhone:      '+351 225 508 048',
  ralEmail:      'cacc@centrodearbitragemdoporto.pt',
  ralWebsite:    'https://www.centrodearbitragemdoporto.pt',
  privacyEmail:  'privacidade@brooklynbarbearia.pt',
  lastUpdated:   '24 de abril de 2026',

  logoUrl:    logoSrc,
  faviconUrl: faviconSrc,

  siteTitle:       'Brooklyn Barbearia',
  siteDescription: 'Barbearia premium no Porto. Reserva online rápida e fácil.',

  // ─ Secção "Sobre" da HomePage ────────────────────────────────────────────
  about: {
    title: 'Bem-vindo à Brooklyn',
    paragraphs: [
      'Desde 2018 no coração do Porto, a <strong>Brooklyn Barbearia</strong> oferece uma experiência única de cuidado masculino. Combinamos técnicas clássicas com as tendências mais modernas.',
      'Os nossos barbeiros estão prontos para proporcionar o melhor serviço, num ambiente acolhedor e autêntico.',
    ],
    // null para ocultar o badge de avaliação
    rating: {
      score: '4,8 / 5,0',
      label: '+ 300 avaliações',
    } as { score: string; label: string } | null,
  },

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

  slotDuration: 30,

  // ─ Personalização visual ─────────────────────────────────────────────────
  theme: {
    navbarBg:       'bg-primary-900 backdrop-blur-md',
    navbarBorder:   'border-white/5',
    sectionLight:   'bg-white',
    sectionMedium:  'bg-gray-50',
    sectionDark:    'bg-gray-100',
    bookingOverlay: 'bg-black/70',
    bookingCard:    'bg-gray-900/95 border-white/10',
    adminBg:        'bg-gray-50',
    adminSidebar:   'bg-gray-950',
  },
} as const

/**
 * TEMA DE CORES
 */
export const themeConfig = {
  primary: {
    50:  '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#16a34a',
    600: '#15803d',
    700: '#166534',
    800: '#14532d',
    900: '#052e16',
  },
  secondary: {
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
    bg:         '#0f172a',
    text:       '#94a3b8',
    textActive: '#ffffff',
    accent:     '#16a34a',
  },
  adminBg: '#f8fafc',
} as const

/**
 * IDs de serviços com restrições de dias da semana
 */
export const serviceRestrictions: Record<number, { allowedDays: number[]; message: string }> = {
  3: { allowedDays: [1, 2, 3, 4], message: 'Desconto estudante disponível de Segunda a Quinta' },
  4: { allowedDays: [1, 2, 3, 4], message: 'Desconto estudante disponível de Segunda a Quinta' },
}

// ─ Agrupamento de horários ────────────────────────────────────────────────
type DayKey = keyof typeof barberShopConfig.workingHours

const DAY_LABELS: Record<DayKey, string> = {
  monday:    'Segunda',
  tuesday:   'Terça',
  wednesday: 'Quarta',
  thursday:  'Quinta',
  friday:    'Sexta',
  saturday:  'Sábado',
  sunday:    'Domingo',
}

const DAY_ORDER: DayKey[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
]

export interface HourGroup {
  label:  string
  hours:  string
  closed: boolean
}

/**
 * Agrupa dias consecutivos com o mesmo horário.
 * Ex: Seg–Sex 10:00–20:00 + Sáb 09:00–18:00 + Dom fechado
 * → [{label:'Segunda a Sexta', hours:'10:00 – 20:00', closed:false}, ...]
 */
export function groupWorkingHours(): HourGroup[] {
  const wh = barberShopConfig.workingHours

  type Group = { keys: DayKey[]; open: string; close: string; closed: boolean }
  const groups: Group[] = []

  for (const key of DAY_ORDER) {
    const h    = wh[key]
    const last = groups.length > 0 ? groups[groups.length - 1] : null

    const sameAsLast =
      last != null &&
      last.closed === h.closed &&
      last.open   === h.open   &&
      last.close  === h.close

    if (sameAsLast && last) {
      last.keys.push(key)
    } else {
      groups.push({ keys: [key], open: h.open, close: h.close, closed: h.closed })
    }
  }

  return groups.map((g): HourGroup => {
    const firstKey = g.keys[0]
    const lastKey  = g.keys[g.keys.length - 1]
    const first    = DAY_LABELS[firstKey]
    const last     = DAY_LABELS[lastKey]
    const label    = g.keys.length === 1 ? first : `${first} a ${last}`
    const hours    = g.closed ? 'Fechado' : `${g.open} – ${g.close}`
    return { label, hours, closed: g.closed }
  })
}
