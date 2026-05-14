/**
 * Service Worker — Brooklyn Barbearia PWA
 *
 * Estratégia:
 *  - Cache-first para assets estáticos (JS, CSS, imagens, fontes)
 *  - Network-first para chamadas de API (/api/)
 *  - Offline fallback para navegação (devolve /index.html)
 *
 * O `start_url` correto (/ vs /admin/dashboard) é definido no manifest
 * escolhido pelo cliente em `pwa-register.ts` — este SW apenas garante
 * que a app funciona offline e que o deep-link de arranque é respeitado.
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE  = `bb-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `bb-dynamic-${CACHE_VERSION}`

// Assets a pre-cachear no install
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-admin.json',
]

// ─── Install ─────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const allowedCaches = [STATIC_CACHE, DYNAMIC_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !allowedCaches.includes(k)).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  )
})

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Ignorar requests não-GET e cross-origin (ex.: Supabase, Cloudflare)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API → Network-first, sem cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // Assets estáticos (JS/CSS/imagens/fontes) → Cache-first
  if (
    url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp|mp4|webm)$/)
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            const clone = response.clone()
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone))
            return response
          })
      )
    )
    return
  }

  // Navegação (HTML) → Network-first, fallback para /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
        .then((r) => r ?? caches.match('/index.html'))
    )
    return
  }

  // Restantes → Stale-while-revalidate no DYNAMIC_CACHE
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          cache.put(request, response.clone())
          return response
        })
        return cached ?? fetchPromise
      })
    )
  )
})
