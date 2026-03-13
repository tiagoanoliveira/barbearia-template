import { api } from './client'

export interface LoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  token: string
  user: {
    id: number
    name: string
    email: string
    role: 'admin' | 'barber'
  }
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<AuthResponse>('/api/admin/auth/login', payload),

  logout: () =>
    api.post('/api/admin/auth/logout', {}),

  me: () =>
    api.get<AuthResponse['user']>('/api/admin/auth/me'),
}
