import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { adminApi } from '@/api/client'

export interface AdminUserSession {
  id?: number
  username?: string
  name?: string
  role?: 'admin' | 'barbeiro' | 'superAdmin' | string
  barbeiro_id?: number | null
}

/** Lê o utilizador do localStorage (apenas para display inicial rápido). */
export function getAdminUser(): AdminUserSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('admin_user')
    if (!raw) return null
    const parsed = JSON.parse(raw) as AdminUserSession
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/** Hook que sincroniza o utilizador do localStorage com eventos de storage/focus. */
export function useAdminUser() {
  const [adminUser, setAdminUser] = useState<AdminUserSession | null>(() => getAdminUser())
  useEffect(() => {
    const sync = () => setAdminUser(getAdminUser())
    window.addEventListener('storage', sync)
    window.addEventListener('focus', sync)
    return () => {
      window.removeEventListener('storage', sync)
      window.removeEventListener('focus', sync)
    }
  }, [])
  return adminUser
}

/**
 * Hook que vai buscar o utilizador REAL ao backend (/api/admin/me).
 * O role devolvido vem da BD — não do localStorage, que pode ter sido manipulado.
 * Atualiza também o localStorage com os dados reais para manter coerência de display.
 */
export function useAdminMe() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('admin_token') : null

  const query = useQuery<AdminUserSession | null>({
    queryKey: ['admin-me'],
    queryFn:  async () => {
      const res = await adminApi.get<AdminUserSession>('/api/admin/me')
      if (res.success && res.data) {
        // Actualiza o localStorage com o role REAL vindo do servidor
        localStorage.setItem('admin_user', JSON.stringify(res.data))
        return res.data
      }
      return null
    },
    enabled:   !!token,
    staleTime: 60_000,   // revalida a cada minuto
    retry:     false,    // um 401 é definitivo — não tentar novamente
  })

  return {
    adminUser: query.data ?? null,
    isLoading: query.isLoading,
    isError:   query.isError,
  }
}

export function isSuperAdmin(user: AdminUserSession | null): boolean {
  return user?.role === 'superAdmin'
}
