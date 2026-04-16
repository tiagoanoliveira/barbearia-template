import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import HomePage from '../../../src/pages/public/HomePage'

const renderWithRouter = (ui: React.ReactNode) => {
  return render(<BrowserRouter>{ui}</BrowserRouter>)
}

describe('HomePage', () => {
  it('mostra elementos principais da home', () => {
    renderWithRouter(<HomePage />)

    expect(screen.getByText(/faq/i)).toBeInTheDocument()
    expect(screen.getByText(/termos/i)).toBeInTheDocument()
  })
})
