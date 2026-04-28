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
  logoPath:     '/media/images/logos/logo-512px.svg',
}

/** URL completa do logo (usada nos emails) */
export const LOGO_URL = `${SHOP.baseUrl}${SHOP.logoPath}`

/** Alt text do logo */
export const LOGO_ALT = SHOP.name

// NOTA: CURRENT_YEAR foi removido intencionalmente.
// Usar `new Date().getFullYear()` directamente dentro das funções
// para garantir que é avaliado em runtime (não em build-time).

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
}
