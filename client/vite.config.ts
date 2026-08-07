import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // cards.svg carries every court-card face and suit pip, so the app is unusable without it -
      // it belongs in the precache rather than being fetched on demand.
      includeAssets: ['favicon.svg', 'cards.svg'],
      manifest: {
        name: 'Sequence',
        short_name: 'Sequence',
        description: 'Play Sequence online with a friend',
        theme_color: '#0f3d2e',
        background_color: '#0f3d2e',
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
