import { screen } from '@testing-library/react'
import { dashboardApi } from '../../../src/api/dashboard'
import { reservationsApi } from '../../../src/api/reservations'
import DashboardPage from '../../../src/pages/admin/DashboardPage'
import { renderWithProviders } from '../../utils/renderWithProviders'

vi.mock('../../../src/api/dashboard', () => ({
  dashboardApi: {
    stats: vi.fn(),
  },
}))

vi.mock('../../../src/api/reservations', () => ({
  reservationsApi: {
    list: vi.fn(),
  },
}))

describe('DashboardPage (admin)', () => {
  it('renderiza o dashboard com métricas', () => {
    vi.mocked(dashboardApi.stats).mockResolvedValue({
      success: true,
      data: { today: 2, week: 7, month: 21, total_clients: 13, unread_notifications: 1 },
    })
    vi.mocked(reservationsApi.list).mockResolvedValue({
      success: true,
      data: { items: [], total: 0, page: 1, perPage: 6, totalPages: 1 },
    })

    renderWithProviders(<DashboardPage />)

    expect(screen.getByText(/bom dia/i)).toBeInTheDocument()
    expect(screen.getByText(/reservas recentes/i)).toBeInTheDocument()
  })
})
