import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    conditions: ['browser'],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    exclude: ['node_modules', 'dist'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
