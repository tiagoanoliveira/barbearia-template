import { useEffect } from 'react'
import { barberShopConfig } from '@/config/theme'

/**
 * Injeta dinamicamente <title> e <link rel="icon"> no <head>
 * a partir da configuração da barbearia.
 * Usar no PublicLayout para cobrir todas as páginas públicas.
 */
export function useBranding() {
  useEffect(() => {
    // Título da aba
    document.title = barberShopConfig.siteTitle

    // Meta description
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    if (!meta) {
      meta = document.createElement('meta')
      meta.name = 'description'
      document.head.appendChild(meta)
    }
    meta.content = barberShopConfig.siteDescription

    // Favicon dinâmico
    if (barberShopConfig.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'icon'
        document.head.appendChild(link)
      }
      link.href = barberShopConfig.faviconUrl
      // Remove o favicon SVG original para evitar conflito
      const svgIcon = document.querySelector<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]')
      if (svgIcon && svgIcon !== link) svgIcon.remove()
    }
  }, [])
}
