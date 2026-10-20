import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/cashflow-pwa/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'CashFlow Forecast',
        short_name: 'CashFlow',
        description: 'Personal cash flow forecasting & planning',
        theme_color: '#0a1e3a',
        background_color: '#f8fafc',
        display: 'standalone',
        orientation: 'portrait-primary',
        // Relative to Vite `base` (/cashflow-pwa/) so iOS Add-to-Home-Screen
        // opens the app (not the user site root) and resolves icons correctly.
        id: './',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
      },
    }),
  ],
})
