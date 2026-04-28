/**
 * vite-plugin-pwa-assets.ts
 *
 * Plugin Vite que gera sw.js, manifest.json e admin-manifest.json
 * dinamicamente a partir de src/config/theme.ts.
 *
 * Em build:  escreve os ficheiros em public/ antes do Vite copiar para dist/
 * Em dev:    serve os ficheiros via middleware HTTP
 */
import type { Plugin, ViteDevServer } from 'vite'
import fs   from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

// ─── Lê theme.ts via require dinâmico em tempo de build ────────────────────
// O plugin corre em Node, não no browser — podemos importar o TS
// através do ts-node/register que o Vite já tem no contexto.
// Como fallback seguro, lemos os valores do ficheiro source directamente.
function readThemeValues(root: string): {
  name: string
  shortName: string
  description: string
  themeColor: string
  cacheName: string
} {
  const themePath = path.join(root, 'src/config/theme.ts')
  const src = fs.readFileSync(themePath, 'utf-8')

  function extract(field: string): string {
    const m = src.match(new RegExp(`${field}:\\s*'([^']+)'`))
    return m ? m[1] : ''
  }

  const name        = extract('name')
  const description = extract('description')
  const primary500  = extract('500') // primeiro match é primary.500

  // short_name: primeiros 12 chars do name, sem espaços extras
  const shortName = name.split(' ').slice(-1)[0] ?? name

  return {
    name,
    shortName,
    description,
    themeColor: primary500 || '#16a34a',
    cacheName:  name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  }
}

function buildManifest(
  theme: ReturnType<typeof readThemeValues>,
  isAdmin: boolean,
): string {
  const manifest = {
    name:             isAdmin ? `${theme.name} Admin` : theme.name,
    short_name:       isAdmin ? 'Admin' : theme.shortName,
    description:      isAdmin
      ? `Painel de administração — ${theme.name}`
      : theme.description,
    start_url:        isAdmin ? '/admin' : '/',
    scope:            isAdmin ? '/admin' : '/',
    display:          'standalone',
    orientation:      'portrait-primary',
    background_color: '#0a0a0a',
    theme_color:      theme.themeColor,
    lang:             'pt',
    icons: [
      {
        src:     '/media/images/logos/logo-192px.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/media/images/logos/logo-512px.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'any maskable',
      },
    ],
    screenshots: [],
    categories:  ['lifestyle', 'health'],
    shortcuts: isAdmin
      ? [
          {
            name:       'Dashboard',
            short_name: 'Dashboard',
            url:        '/admin',
            icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }],
          },
        ]
      : [
          {
            name:       'Reservar',
            short_name: 'Reservar',
            url:        '/reservar',
            icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name:       'O meu perfil',
            short_name: 'Perfil',
            url:        '/perfil',
            icons: [{ src: '/media/images/logos/logo-192px.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
  }
  return JSON.stringify(manifest, null, 2) + '\n'
}

function buildSW(theme: ReturnType<typeof readThemeValues>): string {
  const c = theme.cacheName
  return `/**
 * Service Worker — ${theme.name} PWA
 * Gerado automaticamente por vite-plugin-pwa-assets.ts
 * NÃO editar manualmente — editar src/config/theme.ts
 *
 * Estratégias de cache:
 *  - Cache-first  → assets estáticos (JS, CSS, imagens, fontes)
 *  - Network-first → chamadas à API (/api/*)
 *  - Network-first → navegação HTML (SPA shell)
 */

const CACHE_VERSION = 'v1'
const STATIC_CACHE  = \`${c}-static-\${CACHE_VERSION}\`
const API_CACHE     = \`${c}-api-\${CACHE_VERSION}\`

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
`
}

export default function pwaAssetsPlugin(): Plugin {
  let rootDir = process.cwd()

  return {
    name: 'vite-plugin-pwa-assets',
    enforce: 'pre',

    configResolved(config) {
      rootDir = config.root
    },

    // ── Build: escreve os ficheiros em public/ ─────────────────────────────
    buildStart() {
      const theme  = readThemeValues(rootDir)
      const pubDir = path.join(rootDir, 'public')

      fs.writeFileSync(path.join(pubDir, 'sw.js'),               buildSW(theme))
      fs.writeFileSync(path.join(pubDir, 'manifest.json'),       buildManifest(theme, false))
      fs.writeFileSync(path.join(pubDir, 'admin-manifest.json'), buildManifest(theme, true))

      console.log(`[pwa-assets] Gerado sw.js + manifests para "${theme.name}" (${theme.themeColor})`)
    },

    // ── Dev server: serve via middleware HTTP ──────────────────────────────
    configureServer(server: ViteDevServer) {
      server.middlewares.use((req, res, next) => {
        const theme = readThemeValues(rootDir)

        if (req.url === '/sw.js') {
          res.setHeader('Content-Type', 'application/javascript')
          res.end(buildSW(theme))
          return
        }
        if (req.url === '/manifest.json') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(buildManifest(theme, false))
          return
        }
        if (req.url === '/admin-manifest.json') {
          res.setHeader('Content-Type', 'application/manifest+json')
          res.end(buildManifest(theme, true))
          return
        }
        next()
      })
    },
  }
}
