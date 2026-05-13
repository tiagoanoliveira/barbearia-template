/**
 * Service Worker — Barbearia PWA
 * Gerado automaticamente por vite-plugin-pwa-assets.ts a partir de src/config/theme.ts.
 * NÃO editar manualmente.
 */

const CACHE_VERSION = 'v2.1'
const STATIC_CACHE  = 'barbearia-static-v1'
const API_CACHE     = 'barbearia-api-v1'

const PRECACHE_URLS = ['/', '/index.html', '/manifest.json', '/media/images/logos/logo-512px.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS).catch((e) => console.warn('[SW] Precache:', e)))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
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
    url.pathname.startsWith('/media/')
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
    if (response.ok) { const cache = await caches.open(cacheName); cache.put(request, response.clone()) }
    return response
  } catch { return new Response('Offline', { status: 503 }) }
}

async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request)
    if (response.ok && request.method === 'GET') { const cache = await caches.open(cacheName); cache.put(request, response.clone()) }
    return response
  } catch {
    const cached = await caches.match(request)
    return cached ?? new Response('Offline', { status: 503 })
  }
}
