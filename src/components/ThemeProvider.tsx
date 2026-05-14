/**
 * ThemeProvider
 *
 * Lê `themeConfig` e `barberShopConfig` de `src/config/theme.ts`
 * e injeta todas as cores como CSS custom properties em <html>.
 *
 * É o único lugar onde os valores concretos de cor entram no DOM.
 * O resto da app (globals.css, Tailwind, componentes) usa apenas
 * as variáveis CSS — nunca valores hardcoded.
 *
 * Ficheiros que mudam por barbearia: src/config/theme.ts
 * Ficheiros genéricos (não tocar): este ficheiro + globals.css + tailwind.config.ts
 */
import { useEffect, type ReactNode } from 'react'
import { themeConfig, barberShopConfig } from '@/config/theme'

interface Props {
  children: ReactNode
}

export default function ThemeProvider({ children }: Props) {
  useEffect(() => {
    const root = document.documentElement

    // ── Escala primary ────────────────────────────────────────────────────
    const p = themeConfig.primary
    root.style.setProperty('--color-primary-50',  p[50])
    root.style.setProperty('--color-primary-100', p[100])
    root.style.setProperty('--color-primary-200', p[200])
    root.style.setProperty('--color-primary-300', p[300])
    root.style.setProperty('--color-primary-400', p[400])
    root.style.setProperty('--color-primary-500', p[500])
    root.style.setProperty('--color-primary-600', p[600])
    root.style.setProperty('--color-primary-700', p[700])
    root.style.setProperty('--color-primary-800', p[800])
    root.style.setProperty('--color-primary-900', p[900])

    // ── Escala secondary ─────────────────────────────────────────────────
    const s = themeConfig.secondary
    root.style.setProperty('--color-secondary-50',  s[50])
    root.style.setProperty('--color-secondary-100', s[100])
    root.style.setProperty('--color-secondary-200', s[200])
    root.style.setProperty('--color-secondary-300', s[300])
    root.style.setProperty('--color-secondary-400', s[400])
    root.style.setProperty('--color-secondary-500', s[500])
    root.style.setProperty('--color-secondary-600', s[600])
    root.style.setProperty('--color-secondary-700', s[700])
    root.style.setProperty('--color-secondary-800', s[800])
    root.style.setProperty('--color-secondary-900', s[900])

    // ── Alias brand → primary (compatibilidade) ─────────────────────────
    root.style.setProperty('--color-brand-50',  p[50])
    root.style.setProperty('--color-brand-100', p[100])
    root.style.setProperty('--color-brand-200', p[200])
    root.style.setProperty('--color-brand-300', p[300])
    root.style.setProperty('--color-brand-400', p[400])
    root.style.setProperty('--color-brand-500', p[500])
    root.style.setProperty('--color-brand-600', p[600])
    root.style.setProperty('--color-brand-700', p[700])
    root.style.setProperty('--color-brand-800', p[800])
    root.style.setProperty('--color-brand-900', p[900])

    // ── Sidebar ───────────────────────────────────────────────────────────
    const sb = themeConfig.sidebar
    root.style.setProperty('--sidebar-bg',          sb.bg)
    root.style.setProperty('--sidebar-text',        sb.text)
    root.style.setProperty('--sidebar-text-active', sb.textActive)
    root.style.setProperty('--sidebar-accent',      sb.accent)

    // ── Admin background ──────────────────────────────────────────────────
    root.style.setProperty('--admin-bg', themeConfig.adminBg)

    // ── Meta theme-color dinâmico ─────────────────────────────────────────
    // (sincroniza com o primary-900 da barbearia)
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (metaTheme) {
      const isAdmin = window.location.pathname.startsWith('/admin')
      metaTheme.content = isAdmin ? p[500] : p[900]
    }

    // ── Título da página ──────────────────────────────────────────────────
    document.title = barberShopConfig.siteTitle

  // Só corre uma vez — themeConfig é estático (const)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <>{children}</>
}
