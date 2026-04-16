import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import BookingPage from '../../../src/pages/public/BookingPage'

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('BookingPage', () => {
  it('renderiza o formulário de marcação', () => {
    renderWithRouter(<BookingPage />)

    expect(screen.getByRole('form')).toBeInTheDocument()
  })
})
