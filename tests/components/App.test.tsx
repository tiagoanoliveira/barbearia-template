import { screen } from '@testing-library/react'
import { api } from '../../src/api/client'
import App from '../../src/App'
import { renderWithProviders } from '../utils/renderWithProviders'

vi.mock('../../src/api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
  adminApi: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    upload: vi.fn(),
  },
}))

describe('App routing', () => {
  it('renderiza a home com navegação', () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, data: [] })

    renderWithProviders(<App />, { route: '/' })

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /reservar agora/i })).toBeInTheDocument()
  })
})
