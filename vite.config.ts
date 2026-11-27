import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Bolta Khata',
        short_name: 'Bolta Khata',
        description: 'SHG meeting ledger you run by voice',
        lang: 'hi',
        theme_color: '#9E1B1F',
        background_color: '#6E1013',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
    }),
  ],
  // In development the API runs separately (npm run dev:api on 8787); in Docker one server does both.
  server: { port: 3000, proxy: { '/api': 'http://localhost:8787' } },
  test: { environment: 'node' },
});
