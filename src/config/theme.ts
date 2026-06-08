/**
 * CONFIGURAÇÃO DA BARBEARIA
 * Para cada nova barbearia, editar apenas este ficheiro.
 */

// ─ Logos / Favicon (servidos do repositório via BASE_URL) ─────────────────
import logoSrc    from '@/media/images/logos/logo-96px.webp'
import faviconSrc from '@/media/images/logos/logo-96px.webp'

// ─ Media da HomePage ──────────────────────────────────────────────────────
import heroVideoSrc    from '@/media/video/presentation.mp4'
import heroVideoWebm   from '@/media/video/presentation.webm'
import videoBackground from '@/media/video/video_background.mp4'
import aboutImgSrc     from '@/media/images/corte-cabelo-detalhe.webp'
import gallery1Src     from '@/media/images/brooklyn/Entrada.webp'
import gallery2Src     from '@/media/images/brooklyn/Cadeiras.webp'
import gallery3Src     from '@/media/images/brooklyn/Sinuca.webp'

export const LOGO_URL    = logoSrc
export const FAVICON_URL = faviconSrc

// Tipo explícito para o rating — permite null para ocultar o badge
type Rating = { score: string; label: string } | null

// ─ Tipo e constante dos horários de funcionamento ─────────────────────────
// Declarados FORA do barberShopConfig para preservar os campos opcionais
// (o "as const" congela os tipos e tornaria breakStart/breakEnd obrigatórios).
//
// ⚠️  Sempre que alterar estes horários, actualizar também:
//     functions/utils/site-config.js → WORKING_HOURS
//
export interface DayHours {
  open:        string   // ex: '10:00'
  close:       string   // ex: '20:00'
  closed:      boolean
  breakStart?: string   // opcional — início da pausa, ex: '13:00'
  breakEnd?:   string   // opcional — fim da pausa,   ex: '14:00'
}

export const WORKING_HOURS_CONFIG: Record<
    'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
    DayHours
> = {
  //   monday:    { open: '10:00', close: '20:00', closed: false, breakStart: '13:00', breakEnd: '14:00' },
  monday:    { open: '10:00', close: '20:00', closed: false},
  tuesday:   { open: '10:00', close: '20:00', closed: false},
  wednesday: { open: '10:00', close: '20:00', closed: false},
  thursday:  { open: '10:00', close: '20:00', closed: false},
  friday:    { open: '10:00', close: '20:00', closed: false},
  saturday:  { open: '09:00', close: '18:00', closed: false },
  sunday:    { open: '00:00', close: '00:00', closed: true  },
}

export const barberShopConfig = {
  // Identidade
  name:        'Brooklyn Barbearia',
  tagline:     'Tradição e estilo em cada corte',
  description: 'Barbearia premium no coração da cidade. Cortes clássicos e modernos.',
  phone:       '+351 224 938 542',
  email:       'geral@brooklynbarbearia.pt',
  address:     'Rua do Campo Alegre, 450, Porto',
  instagram:   'https://instagram.com/brooklynbarbeariapt',
  supportIframeSrc: 'https://tiagoanoliveira.pt/support/988b8a8a745c445fbaff596ad5be54dd',

  // ─ Cloudflare Turnstile ─────────────────────────────────────────────────
  turnstileSiteKey: '0x4AAAAAACob-aLDgwmHRXUO',

  // ─ Web Push (VAPID) ──────────────────────────────────────────────────────
  // Chave pública VAPID — gerada com `npx web-push generate-vapid-keys`
  // A chave privada correspondente deve estar em VAPID_PRIVATE_KEY nas
  // variáveis de ambiente do Cloudflare (nunca expor no frontend).
  vapidPublicKey: 'BLZgq4JhJQEiLs3bJv2gwU3u4W6E2MN7rC-rKDjkZBdvH_JQrYZQ9nCiRvuD_0JUmjpVZe10suA0rHxQFM_Rsw0',

  // ─ OAuth social ──────────────────────────────────────────────────────────
  // O botão do Facebook fica oculto e o do Google ocupa a linha toda.
  facebookEnabled: true,

  // Dados legais
  nif:           '515753300',
  legalName:     'Horizonte Inicial.',
  legalForm:     'Sociedade por Quotas',
  comarca:       'Porto',
  ralName:       'Centro de Arbitragem de Conflitos de Consumo do Porto',
  ralAddress:    'Rua de Damião de Góis, 31, Loja 6, 4050-225 Porto',
  ralPhone:      '+351 225 508 349',
  ralEmail:      'cicap@cicap.pt',
  ralWebsite:    'https://www.centrodearbitragemdoporto.pt',
  privacyEmail:  'geral@brooklynbarbearia.pt',
  lastUpdated:   '24 de abril de 2026',

  logoUrl:    logoSrc,
  faviconUrl: faviconSrc,

  siteTitle:       'Brooklyn Barbearia',
  siteDescription: 'Barbearia premium no Porto. Reserva online rápida e fácil.',

  // ─ Media da HomePage ─────────────────────────────────────────────────────
  media: {
    heroVideo:       heroVideoSrc as string,
    heroVideoWebm:   heroVideoWebm as string,
    videoBackground: videoBackground as string,
    aboutImage: { src: aboutImgSrc as string, alt: 'Barbearia' },
    gallery: [
      { src: gallery1Src as string, alt: 'Entrada da barbearia' },
      { src: gallery2Src as string, alt: 'Cadeiras' },
      { src: gallery3Src as string, alt: 'Mesa de sinuca' },
    ],
  },

  // ─ Secção "Sobre" da HomePage ────────────────────────────────────────────
  about: {
    title: 'Bem-vindo à Brooklyn',
    paragraphs: [
      'Desde 2018 no coração do Porto, a <strong>Brooklyn Barbearia</strong> oferece uma experiência única de cuidado masculino. Combinamos técnicas clássicas com as tendências mais modernas.',
      'Os nossos barbeiros estão prontos para proporcionar o melhor serviço, num ambiente acolhedor e autêntico.',
    ],
    rating: {
      score: '4,8 / 5,0',
      label: '+ 300 avaliações',
    } as Rating,
  },

  // ─ Horário ───────────────────────────────────────────────────────────────
  // Fonte de verdade frontend. Referencia WORKING_HOURS_CONFIG declarado acima.
  // Para alterar horários edita apenas WORKING_HOURS_CONFIG (e o espelho
  // em functions/utils/site-config.js → WORKING_HOURS).
  workingHours: WORKING_HOURS_CONFIG,

  slotDuration: 30,

  // ─ Sistema de fidelização ────────────────────────────────────────────────
  loyalty: {
    /** Activar sistema de fidelização */
    enabled: true,
    /**
     * De quantas em quantas reservas CONCLUÍDAS o cliente ganha um corte gratuito.
     * Ex: 10 → a 10.ª, 20.ª, 30.ª reserva concluída é gratuita.
     * ⚠️  Este valor deve coincidir com o hardcoded nos triggers SQL
     *     (tr_fidelidade_increment / tr_fidelidade_decrement).
     *     Se alterar aqui, actualizar também o schema.sql e o site-config.js.
     */
    everyN: 10,
  },

  // ─ Sistema de descontos ──────────────────────────────────────────────────
  discounts: {
    enabled:              true,
    showOnProfile:        true,
    showGeneralSeparately: true,
  },

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
type DayKey = keyof typeof WORKING_HOURS_CONFIG

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
 * Agrupa dias consecutivos com o mesmo horário para mostrar na UI pública.
 * Inclui a pausa quando definida (ex: "10:00 – 13:00 / 14:00 – 20:00").
 */
export function groupWorkingHours(): HourGroup[] {
  type Group = { keys: DayKey[]; open: string; close: string; closed: boolean; breakStart?: string; breakEnd?: string }
  const groups: Group[] = []

  for (const key of DAY_ORDER) {
    const h    = WORKING_HOURS_CONFIG[key]
    const last = groups.length > 0 ? groups[groups.length - 1] : null

    const sameAsLast =
        last != null &&
        last.closed     === h.closed     &&
        last.open       === h.open       &&
        last.close      === h.close      &&
        (last.breakStart ?? null) === (h.breakStart ?? null) &&
        (last.breakEnd   ?? null) === (h.breakEnd   ?? null)

    if (sameAsLast && last) {
      last.keys.push(key)
    } else {
      groups.push({
        keys:       [key],
        open:       h.open,
        close:      h.close,
        closed:     h.closed,
        breakStart: h.breakStart,
        breakEnd:   h.breakEnd,
      })
    }
  }

  return groups.map((g): HourGroup => {
    const firstKey = g.keys[0]
    const lastKey  = g.keys[g.keys.length - 1]
    const label    = g.keys.length === 1
        ? DAY_LABELS[firstKey]
        : `${DAY_LABELS[firstKey]} a ${DAY_LABELS[lastKey]}`

    let hours = 'Fechado'
    if (!g.closed) {
      hours = (g.breakStart && g.breakEnd)
          ? `${g.open} – ${g.breakStart} / ${g.breakEnd} – ${g.close}`
          : `${g.open} – ${g.close}`
    }
    return { label, hours, closed: g.closed }
  })
}