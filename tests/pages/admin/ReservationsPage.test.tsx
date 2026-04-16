import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ReservationsPage from '../../../src/pages/admin/ReservationsPage'

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('ReservationsPage (admin)', () => {
  it('renderiza a listagem de reservas', () => {
    renderWithRouter(<ReservationsPage />)

    expect(screen.getByText(/reservas/i)).toBeInTheDocument()
  })
})
