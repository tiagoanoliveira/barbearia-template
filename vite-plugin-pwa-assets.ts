/**
 * vite-plugin-pwa-assets.ts
 *
 * Lê src/config/theme.ts em Node (build time / dev server) e:
 *  - Injeta env vars VITE_SHOP_* para substituir placeholders no index.html
 *  - Gera public/sw.js, public/manifest.json, public/admin-manifest.json
 *    (public/ é copiado tal-e-qual para dist/ pelo Vite — URLs estáticas garantidas)
 *
 * NUNCA hardcode dados da barbearia aqui — tudo vem do theme.ts.
 */
import type { Plugin, ViteDevServer } from 'vite'
import fs   from 'node:fs'
import path from 'node:path'

// ─── Lê os valores relevantes do theme.ts via regex simples ──────────────────
export interface ThemeValues {
  name:        string
  shortName:   string
  description: string
  themeColor:  string
  cacheName:   string
}

export function readThemeValues(root: string): ThemeValues {
  const src = fs.readFileSync(path.join(root, 'src/config/theme.ts'), 'utf-8')

  const field = (key: string) => {
    const m = src.match(new RegExp(`\\b${key}:\\s*'([^']+)'`))
    return m?.[1] ?? ''
  }

  const colorMatch = src.match(/'500':\s*'(#[0-9a-fA-F]{6})'/)
  const themeColor = colorMatch?.[1] ?? '#16a34a'

  const name      = field('name')
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

// Os ícones ficam em public/icons/ → servidos como /icons/logo-*.png
// (URLs estáticas, sem hash, garantidas pelo Cloudflare Pages / Vite)
const ICON_192 = '/media/images/logos/logo-192px.png'
const ICON_512 = '/media/images/logos/logo-512px.png'

function buildManifest(t: ThemeValues, isAdmin: boolean): string {
  const obj = {
    name:             isAdmin ? `${t.name} Admin` : t.name,
    short_name:       isAdmin ? 'Admin' : t.shortName,
    description:      isAdmin ? `Painel de administração — ${t.name}` : t.description,
    start_url:        isAdmin ? '/admin/' : '/',
    scope:            isAdmin ? '/admin/' : '/',
    display:          'standalone',
    orientation:      'portrait-primary',
    background_color: '#0a0a0a',
    theme_color:      t.themeColor,
    lang:             'pt',
    icons: [
      // "any" — ícone normal (com fundo transparente)
      { src: ICON_192, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: ICON_512, sizes: '512x512', type: 'image/png', purpose: 'any' },
      // "maskable" — ícone com safe-zone para Android adaptive icons
      // O Chrome exige pelo menos um ícone maskable ≥ 192 px para mostrar
      // "Instalar app" em vez de "Criar atalho"
      { src: ICON_512, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    screenshots: [],
    categories:  ['lifestyle', 'health'],
    shortcuts: isAdmin
      ? [{
          name: 'Dashboard', short_name: 'Dashboard', url: '/admin/',
          icons: [{ src: ICON_192, sizes: '192x192', type: 'image/png' }],
        }]
      : [
          {
            name: 'Reservar', short_name: 'Reservar', url: '/reservar',
            icons: [{ src: ICON_192, sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'O meu perfil', short_name: 'Perfil', url: '/perfil',
            icons: [{ src: ICON_192, sizes: '192x192', type: 'image/png' }],
          },
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

const CACHE_VERSION = 'v2.1'
const STATIC_CACHE  = '${t.cacheName}-static-v2.1'
const API_CACHE     = '${t.cacheName}-api-v2.1'

const PRECACHE_URLS = ['/']

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
    url.pathname.startsWith('/logos/') ||
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
`
}

// ─── Plugin ───────────────────────────────────────────────────────────────────

export default function pwaAssetsPlugin(): Plugin {
  let rootDir = process.cwd()

  function write(root: string) {
    const t         = readThemeValues(root)
    // Os ficheiros vão para public/ — o Vite copia-os tal-e-qual para dist/
    // garantindo URLs estáticas sem hash (ex: /sw.js, /manifest.json)
    const publicDir = path.join(root, 'public')
    fs.mkdirSync(publicDir, { recursive: true })
    fs.writeFileSync(path.join(publicDir, 'sw.js'),               buildSW(t))
    fs.writeFileSync(path.join(publicDir, 'manifest.json'),       buildManifest(t, false))
    fs.writeFileSync(path.join(publicDir, 'admin-manifest.json'), buildManifest(t, true))
    console.log(`[pwa-assets] "${t.name}" | theme_color ${t.themeColor} | cache "${t.cacheName}-*"`)
    return t
  }

  return {
    name:    'vite-plugin-pwa-assets',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
    },

    config() {
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

    buildStart() {
      write(rootDir)
    },

    // Dev server: serve os 3 ficheiros dinamicamente a partir de public/
    // (o Vite já os serviria de public/, mas este handler garante freshness
    //  quando theme.ts muda sem reiniciar o servidor)
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
