import type { ApiResponse } from '@/types'

const BASE_URL = ''

/**
 * Cliente HTTP centralizado.
 *
 * tokenKey define EXACTAMENTE qual chave usar no localStorage.
 * NÃO há fallback entre admin_token e user_token — são sessões completamente
 * separadas e nunca se devem misturar.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenKey: 'admin_token' | 'user_token' = 'user_token'
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem(tokenKey)

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    // Token de cliente expirado: limpa só user_token, nunca toca no admin
    if (tokenKey === 'user_token') {
      localStorage.removeItem('user_token')
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
      }
    }
    return { success: false, error: 'Sessão expirada' }
  }

  return res.json()
}

// Cliente para chamadas públicas (sem token obrigatório) e de cliente
export const api = {
  get:    <T>(path: string)                => request<T>(path, {}, 'user_token'),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }, 'user_token'),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }, 'user_token'),
  delete: <T>(path: string)               => request<T>(path, { method: 'DELETE' }, 'user_token'),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, 'user_token'),
}

// Cliente exclusivo para chamadas do painel de admin
export const adminApi = {
  get:    <T>(path: string)                => request<T>(path, {}, 'admin_token'),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }, 'admin_token'),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }, 'admin_token'),
  delete: <T>(path: string)               => request<T>(path, { method: 'DELETE' }, 'admin_token'),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }, 'admin_token'),

  /** Upload multipart para o proxy R2 de admin */
  upload: async (formData: FormData): Promise<ApiResponse<{ publicUrl: string }>> => {
    const token = localStorage.getItem('admin_token')
    const res   = await fetch('/api/admin/upload-proxy', {
      method:  'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body:    formData,
    })
    if (res.status === 401) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
      return { success: false, error: 'Sessão expirada' }
    }
    return res.json()
  },
}
