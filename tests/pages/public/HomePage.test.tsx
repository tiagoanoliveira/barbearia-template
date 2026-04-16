import { screen } from '@testing-library/react'
import { api } from '../../../src/api/client'
import HomePage from '../../../src/pages/public/HomePage'
import { renderWithProviders } from '../../utils/renderWithProviders'

vi.mock('../../../src/api/client', () => ({
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

describe('HomePage', () => {
  it('mostra secções principais da home', () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, data: [] })

    renderWithProviders(<HomePage />)

    expect(screen.getByRole('heading', { name: /serviços/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /a equipa/i })).toBeInTheDocument()
  })
})
