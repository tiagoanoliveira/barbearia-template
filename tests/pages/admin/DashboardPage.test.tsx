import { screen } from '@testing-library/react'
import { dashboardApi } from '../../../src/api/dashboard'
import { reservationsApi } from '../../../src/api/reservations'
import { barbersApi } from '../../../src/api/barbers'
import DashboardPage from '../../../src/pages/admin/DashboardPage'
import { renderWithProviders } from '../../utils/renderWithProviders'

vi.mock('../../../src/api/dashboard', () => ({
  dashboardApi: {
    todayByBarber: vi.fn(),
    comparison: vi.fn(),
  },
}))

vi.mock('../../../src/api/reservations', () => ({
  reservationsApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../../src/api/barbers', () => ({
  barbersApi: {
    list: vi.fn(),
  },
}))

describe('DashboardPage (admin)', () => {
  it('renderiza o dashboard com métricas', () => {
    vi.mocked(dashboardApi.todayByBarber).mockResolvedValue({
      success: true,
      data: [{ barbeiro_id: 1, barbeiro_nome: 'Tiago', barbeiro_color: '#000', confirmadas: 1, concluidas: 2, canceladas: 0, faltas: 0 }],
    })
    vi.mocked(dashboardApi.comparison).mockResolvedValue({
      success: true,
      data: [],
    })
    vi.mocked(barbersApi.list).mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Tiago', active: true }],
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
