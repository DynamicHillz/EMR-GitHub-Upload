import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Precaches the built app shell (JS/CSS/index.html) so the app loads
      // with no network connection — API calls still go over the network
      // (or the offline write queue, see offlineQueue.ts) and are NOT
      // cached here; this only makes the shell itself bootable offline.
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        // Never let Workbox intercept API calls — those are handled by the
        // app's own offline-queue logic, not a cache-first service worker.
        navigateFallbackDenylist: [/^\/api\//],
      },
      manifest: {
        name: 'SSMC EMR',
        short_name: 'SSMC EMR',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2563eb',
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@frontend': path.resolve(__dirname, './src/frontend'),
      '@shared': path.resolve(__dirname, './src/shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist/frontend',
    emptyOutDir: true,
  },
});
