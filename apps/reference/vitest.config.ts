import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    globals: true,
    include: ['__tests__/**/*.test.ts'],
    environment: 'node',
    coverage: {
      reporter: ['text', 'html'],
      include: ['server/**/*.ts', 'composables/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname),
    },
  },
});
