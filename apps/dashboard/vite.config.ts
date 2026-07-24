import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('../../packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('../../packages/core/src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['@fsparts/ui', '@fsparts/core'],
  },
  server: { port: 5175 },
})
