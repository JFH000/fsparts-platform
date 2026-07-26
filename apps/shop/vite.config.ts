import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5173 },
  test: {
    environment: 'node',
    setupFiles: [fileURLToPath(new URL('../../vitest.setup.ts', import.meta.url))],
  },
})
