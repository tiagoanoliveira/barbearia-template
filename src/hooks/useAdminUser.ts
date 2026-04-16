import { useEffect, useState } from 'react'

export interface AdminUserSession {
  id?: number
  username?: string
  name?: string
  role?: 'admin' | 'barbeiro' | string
  barbeiro_id?: number | null
}

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
