import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Faz scroll instantâneo para o topo em cada mudança de rota.
 * Colocar imediatamente dentro do <BrowserRouter>, antes das <Routes>.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}
