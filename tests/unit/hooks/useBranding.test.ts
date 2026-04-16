import { renderHook } from '@testing-library/react'
import { barberShopConfig } from '../../../src/config/theme'
import { useBranding } from '../../../src/hooks/useBranding'

describe('useBranding', () => {
  it('aplica título, meta description e favicon', () => {
    document.title = 'Título antigo'
    document.head.querySelector('meta[name="description"]')?.remove()
    document.head.querySelector('link[rel="icon"]')?.remove()

    renderHook(() => useBranding())

    expect(document.title).toBe(barberShopConfig.siteTitle)
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      barberShopConfig.siteDescription,
    )
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      barberShopConfig.faviconUrl,
    )
  })
})
