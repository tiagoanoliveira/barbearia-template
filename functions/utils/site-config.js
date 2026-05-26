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
  // Identidade
  name:         'Brooklyn Barbearia',
  tagline:      'Tradição e estilo em cada corte',

  // Domínio público (sem barra final)
  baseUrl:      'https://brooklynbarbearia.pt',

  // Email de remetente (formato: "Nome <email>")
  fromEmail:    'Brooklyn Barbearia <noreply@brooklynbarbearia.pt>',

  // Contactos
  phone:        '+351 224 938 542',
  email:        'geral@brooklynbarbearia.pt',
  address:      'Rua do Campo Alegre, 450, Porto',

  // URL do logo (relativo ao baseUrl, servido do R2 ou directamente)
  logoPath:     '/icons/logo-512px.png',

  /**
   * Link directo para a página de avaliação no Google Maps.
   * Formato: 'https://g.page/r/<CID>/review'
   *
   * null → o email de pedido de avaliação NÃO é enviado quando a reserva
   *        é marcada como concluída.
   */
  googleReviewUrl: 'https://g.page/r/CRAIdSgyD7_8EAE/review',
}

/** URL completa do logo (usada nos emails) */
export const LOGO_URL = `${SHOP.baseUrl}${SHOP.logoPath}`

/** Alt text do logo */
export const LOGO_ALT = SHOP.name

/**
 * Paleta de cores usada nos templates de email.
 * Centralizada aqui para que uma única alteração actualize todos os emails.
 *
 * Convenção de nomes:
 *   bg*      — fundos de secção ou wrapper
 *   text*    — cor de texto
 *   border*  — cor de borda
 *   btn*     — botão principal
 *   link*    — links no footer
 */
export const EMAIL_COLORS = {
  // ── Estrutura geral ──────────────────────────────────────────────────────
  bodyBg:          '#f8f9fa',
  wrapBgFrom:      '#f5f7fa',
  wrapBgTo:        '#e8ecf1',
  containerBg:     '#ffffff',
  containerShadow: 'rgba(0,0,0,.1)',

  // ── Secção do logo ───────────────────────────────────────────────────────
  logoBg:          '#2d4a3e',

  // ── Headers de cor ───────────────────────────────────────────────────────
  headerGreenFrom: '#16a34a',
  headerGreenTo:   '#22c55e',
  headerRedFrom:   '#c0392b',
  headerRedTo:     '#e74c3c',
  headerGoldFrom:  '#92400e',
  headerGoldTo:    '#d4a017',
  headerAmberFrom: '#b45309',
  headerAmberTo:   '#d97706',

  // ── Conteúdo ─────────────────────────────────────────────────────────────
  contentText:     '#4a5568',
  contentStrong:   '#2d3748',

  // ── Info box ─────────────────────────────────────────────────────────────
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

  // ── Texto de razão de cancelamento ───────────────────────────────────────
  reasonText:      '#78350f',
  reasonBg:        '#fef3c7',

  // ── CTA verde ────────────────────────────────────────────────────────────
  ctaGreenBgFrom:  '#f0fdf4',
  ctaGreenBgTo:    '#dcfce7',
  ctaGreenText:    '#166534',

  // ── CTA âmbar (lembrete) ─────────────────────────────────────────────────
  ctaAmberBgFrom:  '#fffbeb',
  ctaAmberBgTo:    '#fef3c7',
  ctaAmberText:    '#92400e',

  // ── Botão principal ───────────────────────────────────────────────────────
  btnBgFrom:       '#2d4a3e',
  btnBgTo:         '#3d5a4e',
  btnShadow:       'rgba(45,74,62,.3)',

  // ── Link de contacto ──────────────────────────────────────────────────────
  contactLinkBg:   '#f0fdf4',
  contactLinkText: '#2d4a3e',

  // ── Aviso (warn) ─────────────────────────────────────────────────────────
  warnBg:          '#fff3cd',
  warnBorder:      '#ffc107',

  // ── Footer ───────────────────────────────────────────────────────────────
  footerBg:        '#1a202c',
  footerText:      '#a0aec0',
  footerMeta:      '#718096',
  footerLink:      '#d4af7a',
}

/**
 * Horário de funcionamento da barbearia.
 * Espelho de barberShopConfig.workingHours em src/config/theme.ts.
 *
 * Chaves: 0 = Domingo, 1 = Segunda, ..., 6 = Sábado  (convenção JS getDay())
 * open / close: hora em número inteiro (ex: 10 = 10:00, 18 = 18:00)
 * closed: true para dias fechados
 */
export const WORKING_HOURS = {
  0: { closed: true },                        // Domingo
  1: { open: 10, close: 20, closed: false },  // Segunda
  2: { open: 10, close: 20, closed: false },  // Terça
  3: { open: 10, close: 20, closed: false },  // Quarta
  4: { open: 10, close: 20, closed: false },  // Quinta
  5: { open: 10, close: 20, closed: false },  // Sexta
  6: { open:  9, close: 18, closed: false },  // Sábado
}

/**
 * Sistema de fidelização.
 * Espelho de barberShopConfig.loyalty em src/config/theme.ts.
 *
 * enabled  — activar/desactivar em toda a aplicação
 * everyN   — de quantas em quantas reservas concluídas o cliente ganha um corte gratuito.
 *
 * Semântica exacta:
 *   O cliente paga as primeiras (everyN - 1) reservas do ciclo.
 *   Ao concluir a (everyN - 1)ª, a gratuita fica disponível para usar na everyN-ésima.
 *
 * ⚠️  SE ALTERAR everyN: actualizar TAMBÉM os triggers SQL
 *     tr_fidelidade_increment e tr_fidelidade_decrement no schema.sql
 *     (substituir o valor 10 hardcoded neles pelo novo valor).
 */
export const LOYALTY = {
  enabled: true,
  everyN:  10,
}

/**
 * Assuntos dos emails transacionais.
 * Centralizados aqui para que mudar o nome da barbearia
 * actualize automaticamente todos os subjects.
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
