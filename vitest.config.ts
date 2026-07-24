import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@fsparts/ui': fileURLToPath(new URL('./packages/ui/src', import.meta.url)),
      '@fsparts/core': fileURLToPath(new URL('./packages/core/src', import.meta.url)),
      '@': fileURLToPath(new URL('./apps/shop/src', import.meta.url)),
    },
  },
  test: { environment: 'node' },
})
