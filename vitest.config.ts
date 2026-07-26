import { defineConfig, configDefaults } from 'vitest/config'
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
  test: {
    environment: 'node',
    setupFiles: ['./vitest.setup.ts'],
    // .claude/worktrees/ holds nested git worktrees (each a full copy of this repo) --
    // without this, Vitest's default file globbing finds and runs their test files too,
    // colliding with the real ones.
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
