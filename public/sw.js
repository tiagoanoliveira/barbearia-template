/**
 * Service Worker — Barbearia PWA
 * CACHE_VERSION: alterar sempre que se queira forçar actualização em todos os browsers
 */

const CACHE_VERSION = 'v2.3'
const STATIC_CACHE  = `bb-static-${CACHE_VERSION}`
const DYNAMIC_CACHE = `bb-dynamic-${CACHE_VERSION}`

const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/manifest-admin.json',
]

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  const keep = [STATIC_CACHE, DYNAMIC_CACHE]
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

// ─── Mensagens da página ──────────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Só interceptar GET do mesmo origin
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  // API → sempre network, nunca cache
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request).catch(
        () => new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        })
      )
    )
    return
  }

  // sw.js e manifests → nunca cache
  if (
    url.pathname === '/sw.js' ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/manifest-admin.json'
  ) {
    event.respondWith(fetch(request))
    return
  }

  // Assets estáticos (JS, CSS, imagens, fontes) → cache-first
  // IMPORTANTE: clone() ANTES de qualquer await/return para evitar "body already used"
  if (url.pathname.match(/\.(js|css|woff2?|png|jpg|jpeg|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const toCache = res.clone()  // clone ANTES de retornar res
            caches.open(STATIC_CACHE).then((c) => c.put(request, toCache))
          }
          return res
        })
      })
    )
    return
  }

  // Navegação → network-first, fallback /index.html (SPA)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => res ?? caches.match('/index.html'))
        .catch(() => caches.match('/index.html'))
    )
    return
  }

  // Restantes → stale-while-revalidate
  // IMPORTANTE: clone() ANTES de retornar para evitar "body already used"
  event.respondWith(
    caches.open(DYNAMIC_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const fresh = fetch(request).then((res) => {
          if (res && res.status === 200 && res.type !== 'opaque') {
            const toCache = res.clone()  // clone ANTES de retornar res
            cache.put(request, toCache)
          }
          return res
        })
        return cached ?? fresh
      })
    )
  )
})

// ─── Push ─────────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) {
    console.warn('[SW push] evento recebido mas sem dados')
    return
  }

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Barbearia', body: event.data.text() }
  }

  console.log('[SW push] payload recebido:', payload)

  const title   = payload.title ?? 'Barbearia'
  const options = {
    body:     payload.body ?? '',
    icon:     '/icons/logo-96px.webp',
    badge:    '/icons/logo-96px.webp',
    vibrate:  [200, 100, 200],
    tag:      payload.tag ?? 'bb-push',
    renotify: true,
    data: {
      url:             payload.url             ?? '/admin/dashboard',
      notification_id: payload.notification_id ?? null,
    },
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[SW push] showNotification OK:', title))
      .catch((err) => console.error('[SW push] showNotification falhou:', err))
  )
})

// ─── Notification click ───────────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = event.notification.data?.url ?? '/admin/dashboard'

  event.waitUntil(
    // includeUncontrolled: true para apanhar a PWA instalada mesmo sem estar focada
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        // Procurar aba já aberta do mesmo origin
        const existing = clients.find((c) => new URL(c.url).origin === self.location.origin)
        if (existing) {
          return existing.focus().then(() => existing.navigate(target))
        }
        return self.clients.openWindow(target)
      })
  )
})
