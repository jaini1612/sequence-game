import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Sequence',
        short_name: 'Sequence',
        description: 'Play Sequence online with a friend',
        theme_color: '#863bff',
        background_color: '#863bff',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  // @sequence/shared is a workspace package with no build step (it ships .ts source
  // directly), so it must be treated as project source rather than a pre-bundled dependency.
  optimizeDeps: {
    exclude: ['@sequence/shared'],
  },
})
