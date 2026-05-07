import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      srcDir: 'src',
      filename: 'sw.ts',
      strategies: 'injectManifest',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png}'],
        // runtimeCaching은 sw.ts에서 Workbox 라우팅 API로 직접 관리합니다.
        // (network-first, cache-first, stale-while-revalidate 전략)
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  base: './',
})
