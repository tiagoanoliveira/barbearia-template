import type { ApiResponse } from '@/types'

const BASE_URL = ''

async function request<T>(
  path: string,
  options: RequestInit = {},
  tokenKey: 'admin_token' | 'user_token' = 'admin_token'
): Promise<ApiResponse<T>> {
  const token = localStorage.getItem(tokenKey)
    ?? localStorage.getItem('admin_token')
    ?? localStorage.getItem('user_token')

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  if (res.status === 401) {
    // Apenas redireciona para login admin se o token for admin
    if (localStorage.getItem('admin_token')) {
      localStorage.removeItem('admin_token')
      window.location.href = '/admin/login'
    }
    return { success: false, error: 'Sessão expirada' }
  }

  return res.json()
}

export const api = {
  get:    <T>(path: string)                  => request<T>(path),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
  patch:  <T>(path: string, body: unknown)   => request<T>(path, { method: 'PATCH',  body: JSON.stringify(body) }),
}
