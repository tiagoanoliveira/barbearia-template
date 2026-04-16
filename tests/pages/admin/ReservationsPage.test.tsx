import { screen } from '@testing-library/react'
import { barbersApi } from '../../../src/api/barbers'
import { reservationsApi } from '../../../src/api/reservations'
import ReservationsPage from '../../../src/pages/admin/ReservationsPage'
import { renderWithProviders } from '../../utils/renderWithProviders'

vi.mock('../../../src/api/barbers', () => ({
  barbersApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../../src/api/reservations', () => ({
  reservationsApi: {
    list: vi.fn(),
  },
}))

describe('ReservationsPage (admin)', () => {
  it('renderiza a listagem de reservas', async () => {
    vi.mocked(barbersApi.list).mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Tiago', color: '#000000' }],
    })
    vi.mocked(reservationsApi.list).mockResolvedValue({
      success: true,
      data: {
        items: [
          {
            id: 1,
            client_id: 1,
            client_name: 'João Silva',
            barber_id: 1,
            barber_name: 'Tiago',
            service_id: 1,
            service_name: 'Corte',
            service_duration: 30,
            service_price: 15,
            data_hora: '2026-04-20T10:00:00.000Z',
            status: 'confirmada',
          },
        ],
        total: 1,
        page: 1,
        perPage: 20,
        totalPages: 1,
      },
    })

    renderWithProviders(<ReservationsPage />)

    expect(screen.getByPlaceholderText(/pesquisar por cliente, serviço/i)).toBeInTheDocument()
    expect(await screen.findByText('João Silva')).toBeInTheDocument()
  })
})
