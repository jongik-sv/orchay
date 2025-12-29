import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.vue'],
    alias: {
      '~': fileURLToPath(new URL('./app', import.meta.url)),
      '~/types': fileURLToPath(new URL('./types/index.ts', import.meta.url)),
      '~/utils': fileURLToPath(new URL('./app/utils', import.meta.url)),
      '~/stores': fileURLToPath(new URL('./app/stores', import.meta.url)),
      '~/components': fileURLToPath(new URL('./app/components', import.meta.url)),
      '~/server': fileURLToPath(new URL('./server', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['server/utils/**/*.ts', 'app/components/**/*.vue', 'app/composables/**/*.ts'],
      exclude: ['**/node_modules/**', '**/tests/**'],
    },
  },
});
