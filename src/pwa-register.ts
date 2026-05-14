/**
 * pwa-register.ts
 *
 * Regista o Service Worker e injeta dinamicamente o <link rel="manifest">
 * correto consoante a página de instalação:
 *
 *   • Se a página atual começa com /admin  → manifest-admin.json
 *                                            (start_url = /admin/dashboard)
 *   • Qualquer outra página               → manifest.json
 *                                            (start_url = /)
 *
 * IMPORTANTE: este ficheiro deve ser importado o mais cedo possível
 * em main.tsx, ANTES de qualquer render.
 */

export function registerPWA(): void {
  // 1. Seleciona o manifest correto com base na URL de instalação
  const isAdminContext = window.location.pathname.startsWith('/admin')
  const manifestHref   = isAdminContext ? '/manifest-admin.json' : '/manifest.json'

  // Injeta (ou atualiza) o <link rel="manifest">
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = manifestHref

  // Atualiza também o theme-color para o contexto admin
  if (isAdminContext) {
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (metaTheme) metaTheme.content = '#16a34a'

    const metaTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (metaTitle) metaTitle.content = 'Admin BB'
  }

  // 2. Regista o Service Worker (apenas em produção + HTTPS)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((reg) => {
          console.log('[PWA] Service Worker registado:', reg.scope)

          // Escuta atualizações e recarrega automaticamente quando há nova versão
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (!newWorker) return

            newWorker.addEventListener('statechange', () => {
              if (
                newWorker.state === 'installed' &&
                navigator.serviceWorker.controller
              ) {
                // Há nova versão disponível — recarrega silenciosamente
                navigator.serviceWorker.addEventListener(
                  'controllerchange',
                  () => window.location.reload(),
                  { once: true }
                )
                newWorker.postMessage({ type: 'SKIP_WAITING' })
              }
            })
          })
        })
        .catch((err) => console.warn('[PWA] Falha no registo do SW:', err))
    })
  }
}
