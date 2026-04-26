/**
 * functions/utils/authz.js
 * Helpers de autorização centralizados.
 * Usam SEMPRE auth.user (lido da BD em authenticateAdmin),
 * NUNCA auth.payload (conteúdo do JWT que pode estar desatualizado ou ser forjado).
 */

/**
 * Verifica se o utilizador autenticado tem pelo menos um dos roles indicados.
 * @param {object} auth  - resultado de authenticateAdmin()
 * @param {...string} allowedRoles
 * @returns {boolean}
 */
export function hasRole(auth, ...allowedRoles) {
  return !!(auth?.success && allowedRoles.includes(auth.user?.role))
}

/** superAdmin */
export function isSuperAdmin(auth) {
  return hasRole(auth, 'superAdmin')
}

/** admin ou superAdmin */
export function isAdmin(auth) {
  return hasRole(auth, 'admin', 'superAdmin')
}

/** barbeiro */
export function isBarber(auth) {
  return hasRole(auth, 'barbeiro')
}

/**
 * Verifica se o utilizador pode aceder a uma reserva específica.
 * - admin / superAdmin: acesso total
 * - barbeiro: apenas às suas próprias reservas (barbeiro_id coincide)
 */
export function canAccessReservation(auth, reservaBarbeiroId) {
  if (isAdmin(auth)) return true
  if (isBarber(auth)) return auth.user.barbeiro_id === reservaBarbeiroId
  return false
}

/**
 * Verifica se pode gerir utilizadores admin.
 * Apenas admin e superAdmin.
 */
export function canManageAdminUsers(auth) {
  return isAdmin(auth)
}
