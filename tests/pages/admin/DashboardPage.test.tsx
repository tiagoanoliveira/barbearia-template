import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import DashboardPage from '../../../src/pages/admin/DashboardPage'

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('DashboardPage (admin)', () => {
  it('renderiza o dashboard com métricas', () => {
    renderWithRouter(<DashboardPage />)

    expect(screen.getByText(/dashboard/i)).toBeInTheDocument()
  })
})
