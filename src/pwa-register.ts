/**
 * pwa-register.ts
 *
 * Regista o Service Worker e injeta o <link rel="manifest"> correto:
 *   - /admin/* → manifest-admin.json  (start_url = /admin/dashboard)
 *   - resto    → manifest.json        (start_url = /)
 *
 * Importar em main.tsx ANTES do ReactDOM.createRoot.
 */

export function registerPWA(): void {
  const isAdmin    = window.location.pathname.startsWith('/admin')
  const manifestHref = isAdmin ? '/manifest-admin.json' : '/manifest.json'

  // Injectar / actualizar <link rel="manifest">
  let link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = manifestHref

  // Ajustar theme-color no contexto admin
  if (isAdmin) {
    const metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (metaTheme) metaTheme.content = '#16a34a'
    const metaTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]')
    if (metaTitle) metaTitle.content = 'Admin BB'
  }

  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', {
        scope: '/',
        // Nunca usar cache para o próprio ficheiro sw.js
        // (reforça o Cache-Control: no-store do _headers)
        updateViaCache: 'none',
      })
      .then((reg) => {
        console.log('[PWA] SW registado:', reg.scope)

        // Quando um novo SW termina de instalar, activá-lo imediatamente
        reg.addEventListener('updatefound', () => {
          const next = reg.installing
          if (!next) return
          next.addEventListener('statechange', () => {
            if (next.state === 'installed' && navigator.serviceWorker.controller) {
              // Diz ao SW para fazer skipWaiting e recarrega quando ele assumir controlo
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => window.location.reload(),
                { once: true }
              )
              next.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      })
      .catch((err) => console.warn('[PWA] Falha no registo do SW:', err))
  })
}
