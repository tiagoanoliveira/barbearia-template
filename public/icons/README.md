# Ícones PWA

Os ficheiros de ícone desta pasta (`logo-192px.png`, `logo-384px.png`, `logo-512px.png`) devem ser
copiados manualmente a partir de `src/media/images/logos/` sempre que os logos mudarem.

O Vite não processa a pasta `public/` — os ficheiros aqui são servidos directamente na raiz.
Por isso os logos reais têm de existir nesta pasta como estáticos para o manifesto PWA e o
Service Worker os conseguirem servir.

Ficheiros necessários:
- `logo-192px.png` → copiar de `src/media/images/logos/logo-192px.png`
- `logo-384px.png` → copiar de `src/media/images/logos/logo-384px.png`
- `logo-512px.png` → copiar de `src/media/images/logos/logo-512px.png`

Os SVG placeholder genéricos (`icon-192.svg`, `icon-512.svg`, etc.) foram removidos.
