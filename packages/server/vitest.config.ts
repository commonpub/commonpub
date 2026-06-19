import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    hookTimeout: 30000,
    // DB-heavy integration tests (PGlite + the real-Postgres concurrency suite, which
    // creates/drops databases) contend under the full parallel run; 15s was too tight
    // and produced load-only flakes. They run far faster in isolation.
    testTimeout: 30000,
  },
});
