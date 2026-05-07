import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // Use jsdom for tests that need DOM APIs (localStorage, fetch, etc.)
    environment: 'jsdom',
    // Don't auto-start in watch mode for CI
    globals: false,
  },
})
