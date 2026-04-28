/**
 * Service Worker
 *
 * Este ficheiro é gerado automaticamente por vite-plugin-pwa-assets.ts
 * a partir de src/config/theme.ts.
 *
 * - Em `vite dev`  : servido dinamicamente pelo middleware do plugin (este ficheiro não é usado)
 * - Em `vite build`: sobrescrito pelo plugin antes do bundle com os valores correctos
 *
 * NÃO editar manualmente — as alterações serão sobrescritas.
 * Para alterar dados da barbearia editar src/config/theme.ts.
 */

// Valores de fallback genéricos (nunca chegam a produção)
const STATIC_CACHE = 'barbershop-static-v1'
const API_CACHE    = 'barbershop-api-v1'

const PRECACHE_URLS = ['/', '/offline.html']

self.addEventListener('install',  (e) => e.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE_URLS).catch(console.warn)).then(() => self.skipWaiting())))
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== STATIC_CACHE && n !== API_CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())))

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (!url.protocol.startsWith('http')) return
  if (url.pathname.startsWith('/api/'))                                                              { event.respondWith(nf(request, API_CACHE));     return }
  if (['script','style','image','font'].includes(request.destination) || url.pathname.startsWith('/icons/') || url.pathname.startsWith('/assets/')) { event.respondWith(cf(request, STATIC_CACHE)); return }
  if (request.mode === 'navigate')                                                                    { event.respondWith(fetch(request).catch(() => caches.match('/').then((r) => r ?? new Response('Offline',{status:503})))); return }
  event.respondWith(nf(request, STATIC_CACHE))
})

async function cf(req, name) { const c = await caches.match(req); if (c) return c; try { const r = await fetch(req); if (r.ok) { const ca = await caches.open(name); ca.put(req, r.clone()) } return r } catch { return new Response('Offline',{status:503}) } }
async function nf(req, name) { try { const r = await fetch(req); if (r.ok && req.method==='GET') { const ca = await caches.open(name); ca.put(req, r.clone()) } return r } catch { return await caches.match(req) ?? new Response('Offline',{status:503}) } }
