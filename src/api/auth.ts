import { api } from './client'

export const authApi = {
  login: (data: { email: string; password: string }) =>
    api.post<{ token: string; user: { id: number; name: string; email: string; role: string } }>(
      '/api/admin/login', data
    ),

  me: () => api.get('/api/admin/me'),

  logout: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  },
}
