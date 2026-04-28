import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { themeConfig } from '@/config/theme'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,       // 30 segundos
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

function initializeThemeColors() {
  const rootStyle = document.documentElement.style

  for (const [scale, color] of Object.entries(themeConfig.primary)) {
    rootStyle.setProperty(`--color-primary-${scale}`, color)
  }

  for (const [scale, color] of Object.entries(themeConfig.secondary)) {
    rootStyle.setProperty(`--color-secondary-${scale}`, color)
  }
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .catch((err) => console.warn('[SW] Registo falhou:', err))
  })
}

initializeThemeColors()
registerServiceWorker()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
