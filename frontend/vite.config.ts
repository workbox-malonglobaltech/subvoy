import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { IncomingMessage } from 'http'

// https://vitejs.dev/config/

/**
 * Bypass helper: if the browser is navigating to a route (Accept: text/html),
 * let Vite serve index.html so React Router handles it.
 * Fetch/XHR calls (API requests) skip the bypass and get proxied to the backend.
 */
function spaBypass(req: IncomingMessage) {
  if (req.headers.accept?.includes('text/html')) return '/index.html';
}

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/subscriptions': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/workspaces': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/compliance': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /compliance is also a SPA route
      },
      '/plans': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /plans is also a SPA route
      },
      '/health': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/notifications': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /notifications is also a frontend page
      },
      '/imports': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/analytics': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /analytics is both API and SPA route
      },
      '/email-import': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /email-import is also a SPA route
      },
      '/categories': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/fx': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/wallet': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /wallet is both API and SPA route
      },
      '/reports': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /reports is both API and SPA route
      },
      '/webhook': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/admin': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        bypass: spaBypass,   // /admin/* is both API namespace and SPA routes
      },
    },
  },
})
