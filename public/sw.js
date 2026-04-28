/**
 * Service Worker
 * Este ficheiro é gerado automaticamente por vite-plugin-pwa-assets.ts
 * a partir de src/config/theme.ts.
 *
 * Em desenvolvimento (vite dev): servido dinamicamente pelo plugin.
 * Em produção (vite build):      gerado em public/ antes do bundle.
 *
 * NÃO editar manualmente — as alterações serão sobrescritas na próxima build.
 * Para alterar o nome/cor da barbearia editar src/config/theme.ts.
 */

// Fallback estático usado apenas se o plugin não estiver activo.
// Os valores aqui são sobrescritos pelo plugin em build/dev.
const CACHE_VERSION = 'v1'
const STATIC_CACHE  = `barbershop-static-${CACHE_VERSION}`
const API_CACHE     = `barbershop-api-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/offline.html',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache falhou:', err)
      })
    ).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== API_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  if (!url.protocol.startsWith('http')) return

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  if (
    request.destination === 'script' ||
    request.destination === 'style'  ||
    request.destination === 'image'  ||
    request.destination === 'font'   ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/assets/')
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE))
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r ?? new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  event.respondWith(networkFirst(request, STATIC_CACHE))
})

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request)
  if (cached) return cached
  try {
    const response = await fetch(request)
    if (response.ok) {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    return new Response('Offline', { status: 503 })
  }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok && request.method === 'GET') {
      const cache = await caches.open(cacheName)
      cache.put(request, response.clone())
    }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response('Offline', { status: 503 })
  }
}
