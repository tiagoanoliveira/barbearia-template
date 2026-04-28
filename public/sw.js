/**
 * Service Worker — Brooklyn Barbearia PWA
 *
 * Estratégias de cache:
 *  - Cache-first  → assets estáticos (JS, CSS, imagens, fontes)
 *  - Network-first → chamadas à API (/api/*)
 *  - Network-first → navegação HTML (SPA shell)
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE  = `brooklyn-static-${CACHE_VERSION}`
const API_CACHE     = `brooklyn-api-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/offline.html',
]

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache falhou:', err)
      })
    ).then(() => self.skipWaiting())
  )
})

// ── Activate ──────────────────────────────────────────────────────────────────
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

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar extensões de browser e requests não-HTTP
  if (!url.protocol.startsWith('http')) return

  // API → network-first, cache de curta duração (stale-while-revalidate)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE))
    return
  }

  // Assets estáticos (JS, CSS, imagens, fontes, ícones) → cache-first
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

  // Navegação HTML (SPA) → network-first, fallback para /
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then((r) => r ?? new Response('Offline', { status: 503 }))
      )
    )
    return
  }

  // Tudo o resto → network-first
  event.respondWith(networkFirst(request, STATIC_CACHE))
})

// ── Helpers ───────────────────────────────────────────────────────────────────

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
