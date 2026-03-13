/**
 * Padroniza todas as respostas JSON do backend
 */

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  })
}

export function corsOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export function ok(data)       { return jsonResponse({ success: true,  data }) }
export function created(data)  { return jsonResponse({ success: true,  data }, 201) }
export function badRequest(msg){ return jsonResponse({ success: false, error: msg }, 400) }
export function unauthorized() { return jsonResponse({ success: false, error: 'Não autenticado', needsAuth: true }, 401) }
export function forbidden()    { return jsonResponse({ success: false, error: 'Acesso negado' }, 403) }
export function notFound(msg)  { return jsonResponse({ success: false, error: msg ?? 'Não encontrado' }, 404) }
export function conflict(msg)  { return jsonResponse({ success: false, error: msg }, 409) }
export function serverError(msg, details) {
  return jsonResponse({ success: false, error: msg ?? 'Erro interno', details }, 500)
}
