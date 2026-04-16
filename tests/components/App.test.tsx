import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import App from '../src/App'

describe('App routing', () => {
  it('renders without crashing and shows home content', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>,
    )

    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByText(/faq/i)).toBeInTheDocument()
  })
})
