/**
 * vite-plugin-pwa-assets.ts
 *
 * Lê src/config/theme.ts em Node (build time / dev server) e:
 *  - Injeta env vars VITE_SHOP_* para substituir placeholders no index.html
 *  - Gera src/sw.js, src/manifest.json, src/admin-manifest.json
 *    (src/ é o directório servido — não public/)
 *
 * NUNCA hardcode dados da barbearia aqui — tudo vem do theme.ts.
 */
import type { Plugin, ViteDevServer } from 'vite'
import fs   from 'node:fs'
import path from 'node:path'

// ─── Lê os valores relevantes do theme.ts via regex simples ──────────────────
// (O plugin corre em Node antes do Vite processar o TS, por isso usamos fs.)
export interface ThemeValues {
  name:        string
  shortName:   string
  description: string
  themeColor:  string
  cacheName:   string
}

export function readThemeValues(root: string): ThemeValues {
  const src = fs.readFileSync(path.join(root, 'src/config/theme.ts'), 'utf-8')

  // Extrai campos simples: field: 'value'
  const field = (key: string) => {
    const m = src.match(new RegExp(`\\b${key}:\\s*'([^']+)'`))
    return m?.[1] ?? ''
  }

  // primary[500] está dentro do bloco themeConfig.primary — apanha o primeiro
  // '500': '#xxxxxx' que aparecer no ficheiro
  const colorMatch = src.match(/'500':\s*'(#[0-9a-fA-F]{6})'/)
  const themeColor = colorMatch?.[1] ?? '#16a34a'

  const name      = field('name')
  // short_name = primeira palavra do nome (ex: "Brooklyn Barbearia" → "Brooklyn")
  const shortName = name.split(/\s+/).filter(Boolean)[0] ?? name

  return {
    name,
    shortName,
    description: field('description'),
    themeColor,
    cacheName: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  }
}

// ─── Conteúdo gerado ─────────────────────────────────────────────────────────

function buildManifest(t: ThemeValues, isAdmin: boolean): string {
  const obj = {
    name:             isAdmin ? `${t.name} Admin` : t.name,
    short_name:       isAdmin ? 'Admin' : t.shortName,
    description:      isAdmin ? `Painel de administração — ${t.name}` : t.description,
    start_url:        isAdmin ? '/admin' : '/',
    scope:            isAdmin ? '/admin' : '/',
    display:          'standalone',
    orientation:      'portrait-primary',
    background_color: '#0a0a0a',
    theme_color:      t.themeColor,
    lang:             'pt',
    icons: [
      { src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/media/images/logos/logo-512px.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ],
    screenshots: [],
    categories:  ['lifestyle', 'health'],
    shortcuts: isAdmin
      ? [{ name: 'Dashboard', short_name: 'Dashboard', url: '/admin',
           icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }] }]
      : [
          { name: 'Reservar',      short_name: 'Reservar', url: '/reservar',
            icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }] },
          { name: 'O meu perfil', short_name: 'Perfil',   url: '/perfil',
            icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }] },
        ],
  }
  return JSON.stringify(obj, null, 2) + '\n'
}

function buildSW(t: ThemeValues): string {
  return `/**
 * Service Worker — ${t.name} PWA
 * Gerado automaticamente por vite-plugin-pwa-assets.ts a partir de src/config/theme.ts.
 * NÃO editar manualmente.
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE  = '${t.cacheName}-static-v1'
const API_CACHE     = '${t.cacheName}-api-v1'

const PRECACHE_URLS = ['/', '/offline.html']

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
`
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function pwaAssetsPlugin(): Plugin {
  let rootDir = process.cwd()

  function write(root: string) {
    const t      = readThemeValues(root)
    // Os ficheiros vão para src/ — é o directório servido (não public/)
    const srcDir = path.join(root, 'src')
    fs.writeFileSync(path.join(srcDir, 'sw.js'),               buildSW(t))
    fs.writeFileSync(path.join(srcDir, 'manifest.json'),       buildManifest(t, false))
    fs.writeFileSync(path.join(srcDir, 'admin-manifest.json'), buildManifest(t, true))
    console.log(`[pwa-assets] "${t.name}" | theme_color ${t.themeColor} | cache "${t.cacheName}-*"`)
    return t
  }

  return {
    name:    'vite-plugin-pwa-assets',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
    },

    // Injeta env vars para substituição no index.html (transformIndexHtml)
    config(_, env) {
      // Em modo serve o root ainda não está resolvido — usamos cwd
      const root = rootDir || process.cwd()
      try {
        const t = readThemeValues(root)
        return {
          define: {
            'import.meta.env.VITE_SHOP_NAME':        JSON.stringify(t.name),
            'import.meta.env.VITE_SHOP_SHORT_NAME':  JSON.stringify(t.shortName),
            'import.meta.env.VITE_SHOP_DESCRIPTION': JSON.stringify(t.description),
            'import.meta.env.VITE_THEME_COLOR':      JSON.stringify(t.themeColor),
          },
        }
      } catch { return {} }
    },

    // Build: gera os ficheiros antes do Vite copiar src/ para dist/
    buildStart() {
      write(rootDir)
    },

    // Dev server: serve os 3 ficheiros dinamicamente (reflecte mudanças no theme.ts sem reiniciar)
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (url === '/sw.js') {
          const t = readThemeValues(rootDir)
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buildSW(t))
          return
        }
        if (url === '/manifest.json') {
          const t = readThemeValues(rootDir)
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buildManifest(t, false))
          return
        }
        if (url === '/admin-manifest.json') {
          const t = readThemeValues(rootDir)
          res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8')
          res.setHeader('Cache-Control', 'no-store')
          res.end(buildManifest(t, true))
          return
        }
        next()
      })
    },

    // index.html: substitui os placeholders %VITE_SHOP_*%
    transformIndexHtml(html) {
      const t = readThemeValues(rootDir)
      return html
        .replace(/%VITE_SHOP_NAME%/g,        t.name)
        .replace(/%VITE_SHOP_SHORT_NAME%/g,  t.shortName)
        .replace(/%VITE_SHOP_DESCRIPTION%/g, t.description)
        .replace(/%VITE_THEME_COLOR%/g,      t.themeColor)
    },
  }
}
