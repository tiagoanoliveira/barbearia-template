/**
 * functions/utils/site-config.js
 *
 * Fonte de verdade das constantes da barbearia para o backend (Cloudflare Workers).
 *
 * ⚠️  Este ficheiro é o equivalente backend de src/config/theme.ts.
 *     Sempre que alterar dados no theme.ts (nome, domínio, contacto, horário, etc.),
 *     actualize também este ficheiro para manter coerência.
 *
 * O Worker não consegue importar TypeScript/Vite do frontend, por isso
 * mantemos aqui uma cópia das constantes necessárias.
 *
 * ⚠️  NÃO exportar `new Date()` nem `Date.now()` como constantes de topo:
 *     são avaliadas em build-time pelo bundler (esbuild/wrangler) e ficam
 *     congeladas em 1970. Usar sempre `new Date()` inline dentro de funções.
 */

export const SHOP = {
  name:         'Brooklyn Barbearia',
  tagline:      'Tradição e estilo em cada corte',
  baseUrl:      'https://brooklynbarbearia.pt',
  fromEmail:    'Brooklyn Barbearia <noreply@brooklynbarbearia.pt>',
  phone:        '+351 224 938 542',
  email:        'geral@brooklynbarbearia.pt',
  address:      'Rua do Campo Alegre, 450, Porto',
  logoPath:     '/icons/logo-192px.webp',
  googleReviewUrl: 'https://g.page/r/CRAIdSgyD7_8EAE/review',
}

export const LOGO_URL = `${SHOP.baseUrl}${SHOP.logoPath}`
export const LOGO_ALT = SHOP.name

export const EMAIL_COLORS = {
  bodyBg:          '#f8f9fa',
  wrapBgFrom:      '#f5f7fa',
  wrapBgTo:        '#e8ecf1',
  containerBg:     '#ffffff',
  containerShadow: 'rgba(0,0,0,.1)',
  logoBg:          '#2d4a3e',
  headerGreenFrom: '#16a34a',
  headerGreenTo:   '#22c55e',
  headerRedFrom:   '#c0392b',
  headerRedTo:     '#e74c3c',
  headerGoldFrom:  '#92400e',
  headerGoldTo:    '#d4a017',
  headerAmberFrom: '#b45309',
  headerAmberTo:   '#d97706',
  contentText:     '#4a5568',
  contentStrong:   '#2d3748',
  infoBoxBg:       '#f7fafc',
  infoBoxBorder:   '#e2e8f0',
  infoBoxTitle:    '#2d3748',
  borderGreen:     '#22c55e',
  borderRed:       '#e74c3c',
  borderAmber:     '#f59e0b',
  infoBoxAmberBg:  '#fffbf5',
  infoBoxReminderBg:     '#fffbeb',
  infoBoxReminderBorder: '#fde68a',
  infoBoxReminderTitle:  '#92400e',
  detailRowBg:     '#ffffff',
  reasonText:      '#78350f',
  reasonBg:        '#fef3c7',
  ctaGreenBgFrom:  '#f0fdf4',
  ctaGreenBgTo:    '#dcfce7',
  ctaGreenText:    '#166534',
  ctaAmberBgFrom:  '#fffbeb',
  ctaAmberBgTo:    '#fef3c7',
  ctaAmberText:    '#92400e',
  btnBgFrom:       '#2d4a3e',
  btnBgTo:         '#3d5a4e',
  btnShadow:       'rgba(45,74,62,.3)',
  contactLinkBg:   '#f0fdf4',
  contactLinkText: '#2d4a3e',
  warnBg:          '#fff3cd',
  warnBorder:      '#ffc107',
  footerBg:        '#1a202c',
  footerText:      '#a0aec0',
  footerMeta:      '#718096',
  footerLink:      '#d4af7a',
}

/**
 * Horário de funcionamento da barbearia.
 * ⚠️  Espelho de WORKING_HOURS_CONFIG em src/config/theme.ts.
 *     Sempre que alterar horários no theme.ts, actualizar também aqui.
 *
 * Chaves: 0 = Domingo, 1 = Segunda, ..., 6 = Sábado  (convenção JS getDay())
 * open / close    : hora em inteiro (ex: 10 = 10:00, 18 = 18:00)
 * breakStart/End  : hora em inteiro, opcional — omitir se não houver pausa
 * closed          : true para dias fechados
 */
export const WORKING_HOURS = {
  0: { closed: true },                                                          // Domingo
  1: { open: 10, close: 20, closed: false, breakStart: 13, breakEnd: 14 },     // Segunda
  2: { open: 10, close: 20, closed: false, breakStart: 13, breakEnd: 14 },     // Terça
  3: { open: 10, close: 20, closed: false, breakStart: 13, breakEnd: 14 },     // Quarta
  4: { open: 10, close: 20, closed: false, breakStart: 13, breakEnd: 14 },     // Quinta
  5: { open: 10, close: 20, closed: false, breakStart: 13, breakEnd: 14 },     // Sexta
  6: { open:  9, close: 18, closed: false },                                    // Sábado — sem pausa
}

/**
 * Sistema de fidelização.
 * ⚠️  Espelho de barberShopConfig.loyalty em src/config/theme.ts.
 */
export const LOYALTY = {
  enabled: true,
  everyN:  10,
}

/**
 * Assuntos dos emails transacionais.
 */
export const EMAIL_SUBJECTS = {
  verifyEmail:   `Confirme o seu email – ${SHOP.name}`,
  passwordReset: `Recuperação de Password – ${SHOP.name}`,
  emailChange:   `Confirme a alteração de email – ${SHOP.name}`,
  newEmail:      `Confirme o novo email – ${SHOP.name}`,
  reservation:   `Reserva confirmada – ${SHOP.name}`,
  cancellation:  `Reserva cancelada – ${SHOP.name}`,
  reviewRequest: `Obrigado pela visita – avalie-nos no Google! – ${SHOP.name}`,
}