import { api } from './client'

export const authApi = {
  // Admin login — envia {username, password} para /api/admin/login
  login: (data: { username: string; password: string }) =>
    api.post<{ token: string; user: { id: number; name: string; username: string; role: string } }>(
      '/api/admin/login', data
    ),

  me: () => api.get('/api/admin/me'),

  logout: () => {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
  },
}
