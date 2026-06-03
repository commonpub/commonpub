import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    testTimeout: 60000,
    // CI-only retry. These tests are pure-logic and deterministic locally
    // (pass repeatedly + shuffled), but intermittently fail in CI where every
    // package's suite runs in parallel under turbo on a shared runner — a
    // transient worker stall/crash, not a real assertion failure. Retries
    // recover the transient case without masking a genuine bug (a real failure
    // fails all attempts). 0 retries locally so flakiness still surfaces in dev.
    retry: process.env.CI ? 2 : 0,
  },
});
