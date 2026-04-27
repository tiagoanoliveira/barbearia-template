/**
 * functions/utils/site-config.js
 *
 * Fonte de verdade das constantes da barbearia para o backend (Cloudflare Workers).
 *
 * ⚠️  Este ficheiro é o equivalente backend de src/config/theme.ts.
 *     Sempre que alterar dados no theme.ts (nome, domínio, contacto, etc.),
 *     actualize também este ficheiro para manter coerência nos emails.
 *
 * O Worker não consegue importar TypeScript/Vite do frontend, por isso
 * mantemos aqui uma cópia das constantes necessárias.
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
  logoPath:     '/media/images/logos/logo-512px.svg',
}

/** URL completa do logo (usada nos emails) */
export const LOGO_URL = `${SHOP.baseUrl}${SHOP.logoPath}`

/** Alt text do logo */
export const LOGO_ALT = SHOP.name

/** Ano corrente (recalculado em cada deploy) */
export const CURRENT_YEAR = new Date().getFullYear()

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
}
