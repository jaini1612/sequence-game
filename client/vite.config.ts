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
      // The default only precaches js/css/html, which would leave the portal's display fonts to the
      // network and drop it back to system type offline. woff2 alone: every browser that can run a
      // service worker reads it, so the .woff fallbacks would only be dead weight in the cache.
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2}'],
      },
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
  // Both shared packages are workspace packages with no build step (they ship .ts source
  // directly), so they must be treated as project source rather than pre-bundled dependencies.
  optimizeDeps: {
    exclude: ['@sequence/shared', '@bluff/shared', '@staccs/shared'],
  },
})
