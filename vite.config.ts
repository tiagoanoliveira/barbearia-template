import { defineConfig } from 'vitest/config'
import react      from '@vitejs/plugin-react'
import pwaAssets  from './vite-plugin-pwa-assets'

export default defineConfig({
  plugins: [
    pwaAssets(),  // deve vir antes do react para que transformIndexHtml corra primeiro
    react(),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  test: {
    environment: 'jsdom',
    globals:     true,
    setupFiles:  './tests/setup.ts',
    include:     ['tests/**/*.test.{ts,tsx}'],
    css:         true,
  },
})
