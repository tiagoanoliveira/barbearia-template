import { renderHook } from '@testing-library/react'
import { useBranding } from '../../src/hooks/useBranding'

describe('useBranding', () => {
  it('retorna informações básicas de branding', () => {
    const { result } = renderHook(() => useBranding())

    expect(result.current.name).toBeTruthy()
    expect(result.current.colors.primary).toBeTruthy()
  })
})
