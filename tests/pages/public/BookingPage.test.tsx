import { screen } from '@testing-library/react'
import { api } from '../../../src/api/client'
import BookingPage from '../../../src/pages/public/BookingPage'
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

describe('BookingPage', () => {
  it('renderiza o primeiro passo da marcação', () => {
    vi.mocked(api.get).mockResolvedValue({ success: true, data: [] })

    renderWithProviders(<BookingPage />, { route: '/reservar' })

    expect(screen.getByRole('heading', { name: /escolha o serviço/i })).toBeInTheDocument()
  })
})
